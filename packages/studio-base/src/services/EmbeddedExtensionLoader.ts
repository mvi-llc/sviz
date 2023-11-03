// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import JSZip from "jszip";

import Logger from "@foxglove/log";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";
import { ExtensionInfo, ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

const log = Logger.getLogger(__filename);

type ManifestConfig = {
  displayName: string;
  description: string;
  homepage: string;
  keywords: string[];
  license: string;
  name: string;
  publisher: string;
  version: string;
  main: string;
};

type ManifestJson = {
  packages: Record<string, { url: string; config: ManifestConfig }>;
};

// Extensions manifest that may have been embedded when self-hosting via Docker
const staticExtensions = (globalThis as { FOXGLOVE_STUDIO_EXTENSIONS?: ManifestJson })
  .FOXGLOVE_STUDIO_EXTENSIONS ?? { packages: {} };

/**
 * Loads extensions from a manifest embedded in Studio's index.html file. This is typically done
 * by bind mounting a directory containing `.foxe` extensions and a `manifest.json` file into
 * the container at `/src/extensions`.
 */
export class EmbeddedExtensionLoader implements ExtensionLoader {
  public readonly namespace: ExtensionNamespace = "org";

  public async getExtensions(): Promise<ExtensionInfo[]> {
    const extensions = Object.entries(staticExtensions.packages).map(([id, entry]) => {
      const config = entry.config;
      const qualifiedName = [this.namespace, config.publisher, config.name].join(":");
      const extensionInfo: ExtensionInfo = {
        id,
        description: config.description,
        displayName: config.displayName,
        homepage: config.homepage,
        keywords: config.keywords,
        license: config.license,
        name: config.name,
        namespace: this.namespace,
        publisher: config.publisher,
        qualifiedName,
        version: config.version,
      };
      return extensionInfo;
    });
    extensions.sort((a, b) => a.id.localeCompare(b.id));

    log.debug(`Found ${extensions.length} embedded extension(s)`);
    return extensions;
  }

  public async loadExtension(id: string): Promise<string> {
    const entry = staticExtensions.packages[id];
    if (entry == undefined) {
      throw new Error(`Unknown extension "${id}"`);
    }

    // Fetch the .foxe zip file from the URL
    const res = await fetch(entry.url);
    if (!res.ok) {
      throw new Error(`Failed to load extension "${id}" from ${entry.url} - ${res.statusText}`);
    }
    const data = await res.arrayBuffer();

    // Load the entry point JavaScript file from the zip
    const zip = new JSZip();
    const content = await zip.loadAsync(data);
    const srcText = await content.file(entry.config.main)?.async("string");
    if (srcText == undefined) {
      throw new Error(`Extension "${id}" at ${entry.url} is missing ${entry.config.main}`);
    }

    return srcText;
  }

  public async installExtension(foxeFileData: Uint8Array): Promise<ExtensionInfo> {
    throw new Error(
      `EmbeddedExtensionLoader#installExtension(${foxeFileData.byteLength} bytes) is not supported`,
    );
  }

  public async uninstallExtension(id: string): Promise<void> {
    throw new Error(`EmbeddedExtensionLoader#uninstallExtension(${id}) is not supported`);
  }
}
