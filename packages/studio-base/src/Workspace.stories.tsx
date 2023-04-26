// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj, StoryFn } from "@storybook/react";
import { fireEvent, screen } from "@storybook/testing-library";

import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import LayoutManagerContext from "@foxglove/studio-base/context/LayoutManagerContext";
import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import PanelCatalogContext, {
  PanelCatalog,
  PanelInfo,
} from "@foxglove/studio-base/context/PanelCatalogContext";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";
import LayoutManagerProvider from "@foxglove/studio-base/providers/LayoutManagerProvider";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager/LayoutManager";
import MockLayoutStorage from "@foxglove/studio-base/services/MockLayoutStorage";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import Workspace from "./Workspace";

export default {
  title: "Workspace",
  component: Workspace,
  parameters: {
    colorScheme: "light",
  },
  decorators: [
    (Wrapped: StoryFn): JSX.Element => {
      const storage = new MockLayoutStorage(LayoutManager.LOCAL_STORAGE_NAMESPACE, []);

      return (
        <LayoutStorageContext.Provider value={storage}>
          <LayoutManagerProvider>
            <Wrapped />
          </LayoutManagerProvider>
        </LayoutStorageContext.Provider>
      );
    },
  ],
};

class MockPanelCatalog implements PanelCatalog {
  static #fakePanel: PanelInfo = {
    title: "Fake Panel",
    type: "Fake",
    module: async () => {
      return {
        default: Panel(
          Object.assign(
            () => (
              <>
                <PanelToolbar />
                <div>I’m a fake panel</div>
              </>
            ),
            { panelType: "Fake", defaultConfig: {} },
          ),
        ),
      };
    },
  };
  public getPanels(): readonly PanelInfo[] {
    return [MockPanelCatalog.#fakePanel];
  }
  public getPanelByType(_type: string): PanelInfo | undefined {
    return MockPanelCatalog.#fakePanel;
  }
}

export const Basic: StoryObj = {
  render: () => {
    const providers = [
      /* eslint-disable react/jsx-key */
      <PanelSetup>{undefined}</PanelSetup>,
      <EventsProvider />,
      <PanelCatalogContext.Provider value={new MockPanelCatalog()} />,
      <MockCurrentLayoutProvider initialState={{ layout: "Fake" }} />,
      <LayoutManagerContext.Provider
        value={
          new LayoutManager({
            local: new MockLayoutStorage(LayoutManager.LOCAL_STORAGE_NAMESPACE, []),
            remote: undefined,
          })
        }
      />,
      /* eslint-enable react/jsx-key */
    ];
    return (
      <MultiProvider providers={providers}>
        <Workspace />
      </MultiProvider>
    );
  },
};

export const FullscreenPanel: StoryObj = {
  ...Basic,
  play: async () => {
    fireEvent.click(await screen.findByTestId("panel-menu"));
    fireEvent.click(await screen.findByTestId("panel-menu-fullscreen"));
  },
};
