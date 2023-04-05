// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { maxBy } from "lodash";

import Logger from "@foxglove/log";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";

import { RenderableLineList } from "./markers/RenderableLineList";
import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { stringToRgba } from "../color";
import { vec3TupleApproxEquals } from "../math";
import { Marker, MarkerAction, MarkerType, TIME_ZERO, Vector3 } from "../ros";
import { CustomLayerSettings, PRECISION_DEGREES, PRECISION_DISTANCE } from "../settings";
import { makePose, xyzrpyToPose } from "../transforms";

const log = Logger.getLogger(__filename);

export type LayerSettingsMapTileSet = CustomLayerSettings & {
  layerId: "sviz.MapTileSet";
  tileServerUrl: string | undefined;
  color: string;
  outline: boolean;
};

const LAYER_ID = "sviz.MapTileSet";
const DEFAULT_COLOR = "#248eff";
const DEFAULT_OUTLINE = true;

const DEFAULT_SETTINGS: LayerSettingsMapTileSet = {
  visible: true,
  frameLocked: true,
  label: "Map Tiles",
  instanceId: "invalid",
  layerId: LAYER_ID,
  tileServerUrl: undefined,
  color: DEFAULT_COLOR,
  outline: DEFAULT_OUTLINE,
};

export type MapTileSetUserData = BaseUserData & {
  settings: LayerSettingsMapTileSet;
  lineList: RenderableLineList;
};

export class MapTileSetRenderable extends Renderable<MapTileSetUserData> {
  public override dispose(): void {
    this.userData.lineList.dispose();
    super.dispose();
  }
}

export class MapTileSets extends SceneExtension<MapTileSetRenderable> {
  public constructor(renderer: Renderer) {
    super("foxglove.MapTileSets", renderer);

    renderer.addCustomLayerAction({
      layerId: LAYER_ID,
      label: "Add Map Tiles",
      icon: "Map",
      handler: this.handleAddMapTileSet,
    });

    renderer.on("transformTreeUpdated", this.handleTransformTreeUpdated);

    // Load existing map tile layers from the config
    for (const [instanceId, entry] of Object.entries(renderer.config.layers)) {
      if (entry?.layerId === LAYER_ID) {
        this._updateMapTileSet(instanceId, entry as Partial<LayerSettingsMapTileSet>);
      }
    }
  }

  public override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    super.dispose();
  }

  public override removeAllRenderables(): void {
    // no-op
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const [instanceId, layerConfig] of Object.entries(this.renderer.config.layers)) {
      if (layerConfig?.layerId !== LAYER_ID) {
        continue;
      }

      const config = layerConfig as Partial<LayerSettingsMapTileSet>;

      // prettier-ignore
      const fields: SettingsTreeFields = {
        color: { label: "Color", input: "rgba", value: config.color ?? DEFAULT_COLOR },
      };

      entries.push({
        path: ["layers", instanceId],
        node: {
          label: config.label ?? "Map Tiles",
          icon: "Map",
          fields,
          visible: config.visible ?? DEFAULT_SETTINGS.visible,
          actions: [{ type: "action", id: "delete", label: "Delete" }],
          order: layerConfig.order,
          handler,
        },
      });

      // Create renderables for new map tile layers
      if (!this.renderables.has(instanceId)) {
        this._updateMapTileSet(instanceId, config);
      }
    }
    return entries;
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;

    // Handle menu actions (delete)
    if (action.action === "perform-node-action") {
      if (path.length === 2 && action.payload.id === "delete") {
        const instanceId = path[1]!;

        // Remove this instance from the config
        this.renderer.updateConfig((draft) => {
          delete draft.layers[instanceId];
        });

        // Remove the renderable
        this._updateMapTileSet(instanceId, undefined);

        // Update the settings tree
        this.updateSettingsTree();
        this.renderer.updateCustomLayersCount();
      }
      return;
    }

    if (path.length !== 3) {
      return; // Doesn't match the pattern of ["layers", instanceId, field]
    }

    this.saveSetting(path, action.payload.value);

    const instanceId = path[1]!;
    const settings = this.renderer.config.layers[instanceId] as
      | Partial<LayerSettingsMapTileSet>
      | undefined;
    this._updateMapTileSet(instanceId, settings);
  };

  private handleAddMapTileSet = (instanceId: string): void => {
    log.info(`Creating ${LAYER_ID} layer ${instanceId}`);

    const config: LayerSettingsMapTileSet = { ...DEFAULT_SETTINGS, instanceId };

    // Add this instance to the config
    this.renderer.updateConfig((draft) => {
      const maxOrderLayer = maxBy(Object.values(draft.layers), (layer) => layer?.order);
      const order = 1 + (maxOrderLayer?.order ?? 0);
      draft.layers[instanceId] = { ...config, order };
    });

    // Add a renderable
    this._updateMapTileSet(instanceId, config);

    // Update the settings tree
    this.updateSettingsTree();
  };

  private handleTransformTreeUpdated = (): void => {
    this.updateSettingsTree();
  };

  private _updateMapTileSet(
    instanceId: string,
    settings: Partial<LayerSettingsMapTileSet> | undefined,
  ): void {
    let renderable = this.renderables.get(instanceId);

    // Handle deletes
    if (settings == undefined) {
      if (renderable != undefined) {
        renderable.userData.lineList.dispose();
        this.remove(renderable);
        this.renderables.delete(instanceId);
      }
      return;
    }

    const newSettings = { ...DEFAULT_SETTINGS, ...settings };
    renderable ??= this._createRenderable(instanceId, newSettings);

    const prevSettings = renderable.userData.settings;
    const markersEqual =
      newSettings.size === prevSettings.size &&
      newSettings.divisions === prevSettings.divisions &&
      newSettings.frameId === prevSettings.frameId &&
      newSettings.lineWidth === prevSettings.lineWidth &&
      newSettings.color === prevSettings.color;

    renderable.userData.settings = newSettings;

    // If the marker settings changed, generate a new marker and update the renderable
    if (!markersEqual) {
      const marker = createMarker(newSettings);
      renderable.userData.lineList.update(marker, undefined);
    }

    // Update the pose if it changed
    if (
      !vec3TupleApproxEquals(newSettings.position, prevSettings.position) ||
      !vec3TupleApproxEquals(newSettings.rotation, prevSettings.rotation)
    ) {
      renderable.userData.pose = xyzrpyToPose(newSettings.position, newSettings.rotation);
    }
  }

  private _createRenderable(
    instanceId: string,
    settings: LayerSettingsMapTileSet,
  ): MapTileSetRenderable {
    const marker = createMarker(settings);
    const lineListId = `${instanceId}:LINE_LIST`;
    const lineList = new RenderableLineList(
      lineListId,
      marker,
      undefined,
      this.renderer,
      LINE_OPTIONS,
    );
    const renderable = new MapTileSetRenderable(instanceId, this.renderer, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId: this.renderer.transformTree.frameList()[0]?.value ?? "",
      pose: makePose(),
      settingsPath: ["layers", instanceId],
      settings,
      lineList,
    });
    renderable.add(lineList);

    this.add(renderable);
    this.renderables.set(instanceId, renderable);
    return renderable;
  }
}

function createMarker(settings: LayerSettingsMapTileSet): Marker {
  const { color: colorStr } = settings;

  const color = { r: 1, g: 1, b: 1, a: 1 };
  stringToRgba(color, colorStr);

  // FIXME
}
