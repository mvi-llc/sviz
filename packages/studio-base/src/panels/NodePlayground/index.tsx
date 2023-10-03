// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Input,
  Link,
  Typography,
  inputClasses,
} from "@mui/material";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ImperativePanelHandle,
  PanelGroup,
  PanelResizeHandle,
  Panel as ResizablePanel,
} from "react-resizable-panels";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";
import { v4 as uuidv4 } from "uuid";

import { SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useUserNodeState } from "@foxglove/studio-base/context/UserNodeStateContext";
import BottomBar from "@foxglove/studio-base/panels/NodePlayground/BottomBar";
import Sidebar from "@foxglove/studio-base/panels/NodePlayground/Sidebar";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig, UserNodes } from "@foxglove/studio-base/types/panels";

import Config from "./Config";
import { Script } from "./script";

const Editor = React.lazy(
  async () => await import("@foxglove/studio-base/panels/NodePlayground/Editor"),
);

const skeletonBody = `\
// The ./types module provides helper types for your Input events and messages.
import { Input, Message } from "./types";

// Your script can output well-known message types, any of your custom message types, or
// complete custom message types.
//
// Use \`Message\` to access types from the schemas defined in your data source:
// type Twist = Message<"geometry_msgs/Twist">;
//
// Import from the @foxglove/schemas package to use foxglove schema types:
// import { Pose, LocationFix } from "@foxglove/schemas";
//
// Conventionally, it's common to make a _type alias_ for your script's output type
// and use that type name as the return type for your script function.
// Here we've called the type \`Output\` but you can pick any type name.
type Output = {
  hello: string;
};

// These are the topics your script "subscribes" to. Studio will invoke your script function
// when any message is received on one of these topics.
export const inputs = ["/input/topic"];

// Any output your script produces is "published" to this topic. Published messages are only visible within Studio, not to your original data source.
export const output = "/studio_script/output_topic";

// This function is called with messages from your input topics.
// The first argument is an event with the topic, receive time, and message.
// Use the \`Input<...>\` helper to get the correct event type for your input topic messages.
export default function script(event: Input<"/input/topic">): Output {
  return {
    hello: "world!",
  };
};`;

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const useStyles = makeStyles()((theme) => ({
  emptyState: {
    backgroundColor: theme.palette.background.default,
  },
  unsavedDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    top: "50%",
    position: "absolute",
    right: theme.spacing(1),
    transform: "translateY(-50%)",
    backgroundColor: theme.palette.text.secondary,
  },
  input: {
    [`.${inputClasses.input}`]: {
      padding: theme.spacing(1),
    },
  },
  resizeHandle: {
    position: "relative",
    height: 10,
    marginTop: -10,

    ":hover": {
      backgroundPosition: "50% 0",
      backgroundSize: "100% 50px",
      backgroundImage: `radial-gradient(${[
        "at center center",
        `${theme.palette.action.focus} 0%`,
        "transparent 70%",
        "transparent 100%",
      ].join(",")})`,
      boxShadow: `0 2px 0 0 ${
        theme.palette.mode === "dark"
          ? tc(theme.palette.divider).lighten().toString()
          : tc(theme.palette.divider).darken().toString()
      }`,
    },
  },
}));

export type Explorer = undefined | "nodes" | "utils" | "templates";

function buildSettingsTree(config: Config): SettingsTreeNodes {
  return {
    general: {
      fields: {
        autoFormatOnSave: {
          input: "boolean",
          label: "Auto-format on save",
          value: config.autoFormatOnSave,
        },
      },
    },
  };
}

const WelcomeScreen = ({ addNewNode }: { addNewNode: (code?: string) => void }) => {
  const { classes } = useStyles();
  return (
    <EmptyState className={classes.emptyState}>
      <Container maxWidth="xs">
        <Stack justifyContent="center" alignItems="center" gap={1} fullHeight>
          <Typography variant="inherit" gutterBottom>
            Welcome to User Scripts!
            <br />
            Get started by reading the{" "}
            <Link
              color="primary"
              underline="hover"
              href="https://foxglove.dev/docs/studio/panels/user-scripts"
              target="_blank"
            >
              docs
            </Link>
            , or just create a new script.
          </Typography>
          <Button
            color="inherit"
            variant="contained"
            onClick={() => {
              addNewNode();
            }}
            startIcon={<AddIcon />}
          >
            New script
          </Button>
        </Stack>
      </Container>
    </EmptyState>
  );
};

const EMPTY_USER_NODES: UserNodes = Object.freeze({});

const userNodeSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.userNodes ?? EMPTY_USER_NODES;

function NodePlayground(props: Props) {
  const { config, saveConfig } = props;
  const { classes, theme } = useStyles();
  const { autoFormatOnSave = false, selectedNodeId, editorForStorybook } = config;
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const [explorer, updateExplorer] = React.useState<Explorer>(undefined);

  const userNodes = useCurrentLayoutSelector(userNodeSelector);
  const {
    state: { nodeStates: userNodeDiagnostics, rosLib, typesLib },
  } = useUserNodeState();

  const { setUserNodes } = useCurrentLayoutActions();

  const selectedNodeDiagnostics =
    (selectedNodeId != undefined ? userNodeDiagnostics[selectedNodeId]?.diagnostics : undefined) ??
    [];
  const selectedNode = selectedNodeId != undefined ? userNodes[selectedNodeId] : undefined;
  const [scriptBackStack, setScriptBackStack] = React.useState<Script[]>([]);
  // Holds the currently active script
  const currentScript =
    scriptBackStack.length > 0 ? scriptBackStack[scriptBackStack.length - 1] : undefined;
  const isCurrentScriptSelectedNode =
    !!selectedNode && !!currentScript && currentScript.filePath === selectedNode.name;
  const isNodeSaved =
    !isCurrentScriptSelectedNode || currentScript.code === selectedNode.sourceCode;
  const selectedNodeLogs =
    (selectedNodeId != undefined ? userNodeDiagnostics[selectedNodeId]?.logs : undefined) ?? [];

  // The current node name is editable via the "tab". The tab uses a controlled input. React requires
  // that we render the new text on the next render for the controlled input to retain the cursor position.
  // For this we use setInputTitle within the onChange event of the input control.
  //
  // We also update the input title when the script changes using a layout effect below.
  const [inputTitle, setInputTitle] = useState<string>(() => {
    return currentScript
      ? currentScript.filePath + (currentScript.readOnly ? " (READONLY)" : "")
      : "script name";
  });

  const prefersDarkMode = theme.palette.mode === "dark";

  const inputStyle = {
    backgroundColor: theme.palette.background[prefersDarkMode ? "default" : "paper"],
    width: `${Math.max(inputTitle.length + 4, 10)}ch`, // Width based on character count of title + padding
  };

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { input, value, path } = action.payload;
      if (input === "boolean" && path[1] === "autoFormatOnSave") {
        saveConfig({ autoFormatOnSave: value });
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config),
    });
  }, [actionHandler, config, updatePanelSettingsTree]);

  React.useLayoutEffect(() => {
    if (selectedNode) {
      const testItems = props.config.additionalBackStackItems ?? [];
      setScriptBackStack([
        { filePath: selectedNode.name, code: selectedNode.sourceCode, readOnly: false },
        ...testItems,
      ]);
    }
  }, [props.config.additionalBackStackItems, selectedNode]);

  React.useLayoutEffect(() => {
    setInputTitle(() => {
      return currentScript
        ? currentScript.filePath + (currentScript.readOnly ? " (READONLY)" : "")
        : "script name";
    });
  }, [currentScript]);

  const saveCurrentNode = useCallback(() => {
    if (
      selectedNodeId != undefined &&
      selectedNode &&
      currentScript &&
      isCurrentScriptSelectedNode
    ) {
      setUserNodes({
        [selectedNodeId]: { ...selectedNode, sourceCode: currentScript.code },
      });
    }
  }, [currentScript, isCurrentScriptSelectedNode, selectedNode, selectedNodeId, setUserNodes]);

  const addNewNode = React.useCallback(
    (code?: string) => {
      saveCurrentNode();
      const newNodeId = uuidv4();
      const sourceCode = code ?? skeletonBody;
      setUserNodes({
        [newNodeId]: {
          sourceCode,
          name: `${newNodeId.split("-")[0]}`,
        },
      });
      saveConfig({ selectedNodeId: newNodeId });
    },
    [saveConfig, saveCurrentNode, setUserNodes],
  );

  const saveNode = React.useCallback(
    (script: string | undefined) => {
      if (selectedNodeId == undefined || script == undefined || script === "" || !selectedNode) {
        return;
      }
      setUserNodes({ [selectedNodeId]: { ...selectedNode, sourceCode: script } });
    },
    [selectedNode, selectedNodeId, setUserNodes],
  );

  const setScriptOverride = React.useCallback(
    (script: Script, maxDepth?: number) => {
      if (maxDepth != undefined && maxDepth > 0 && scriptBackStack.length >= maxDepth) {
        setScriptBackStack([...scriptBackStack.slice(0, maxDepth - 1), script]);
      } else {
        setScriptBackStack([...scriptBackStack, script]);
      }
    },
    [scriptBackStack],
  );

  const goBack = React.useCallback(() => {
    setScriptBackStack(scriptBackStack.slice(0, scriptBackStack.length - 1));
  }, [scriptBackStack]);

  const setScriptCode = React.useCallback(
    (code: string) => {
      // update code at top of backstack
      const backStack = [...scriptBackStack];
      if (backStack.length > 0) {
        const script = backStack.pop();
        if (script && !script.readOnly) {
          setScriptBackStack([...backStack, { ...script, code }]);
        }
      }
    },
    [scriptBackStack],
  );

  const saveOnLeave = useCallback(() => {
    if (isNodeSaved) {
      return;
    }
    // automatically save script on panel leave
    saveCurrentNode();
  }, [isNodeSaved, saveCurrentNode]);

  // The cleanup function below should only run when this component unmounts.
  // We're using a ref here so that the cleanup useEffect doesn't run whenever one of the callback
  // dependencies changes, only when the component unmounts and with the most up-to-date callback.
  const saveOnLeaveRef = useRef(saveOnLeave);
  saveOnLeaveRef.current = saveOnLeave;
  useEffect(() => {
    return () => {
      saveOnLeaveRef.current();
    };
  }, []);

  const bottomBarRef = useRef<ImperativePanelHandle>(ReactNull);

  const onChangeBottomBarTab = useCallback(() => {
    bottomBarRef.current?.expand();
  }, []);

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Divider />
      <Stack direction="row" fullHeight overflow="hidden">
        <Sidebar
          explorer={explorer}
          updateExplorer={updateExplorer}
          selectNode={(nodeId) => {
            saveCurrentNode();
            saveConfig({ selectedNodeId: nodeId });
          }}
          deleteNode={(nodeId) => {
            setUserNodes({ ...userNodes, [nodeId]: undefined });
            saveConfig({ selectedNodeId: undefined });
          }}
          selectedNodeId={selectedNodeId}
          userNodes={userNodes}
          script={currentScript}
          setScriptOverride={setScriptOverride}
          addNewNode={addNewNode}
        />
        <Stack
          flexGrow={1}
          fullHeight
          overflow="hidden"
          style={{
            backgroundColor: theme.palette.background[prefersDarkMode ? "paper" : "default"],
          }}
        >
          <Stack direction="row" alignItems="center">
            {scriptBackStack.length > 1 && (
              <IconButton title="Go back" data-testid="go-back" size="small" onClick={goBack}>
                <ArrowBackIcon />
              </IconButton>
            )}
            {selectedNodeId != undefined && selectedNode && (
              <div style={{ position: "relative" }}>
                <Input
                  className={classes.input}
                  size="small"
                  disableUnderline
                  placeholder="script name"
                  value={inputTitle}
                  disabled={!currentScript || currentScript.readOnly}
                  onChange={(ev) => {
                    const newNodeName = ev.target.value;
                    setInputTitle(newNodeName);
                    setUserNodes({
                      ...userNodes,
                      [selectedNodeId]: { ...selectedNode, name: newNodeName },
                    });
                  }}
                  inputProps={{ spellCheck: false, style: inputStyle }}
                />
                {!isNodeSaved && <div className={classes.unsavedDot} />}
              </div>
            )}
            <IconButton
              title="New node"
              data-testid="new-node"
              size="small"
              onClick={() => {
                addNewNode();
              }}
            >
              <AddIcon />
            </IconButton>
          </Stack>

          <PanelGroup direction="vertical" units="pixels">
            {selectedNodeId == undefined && <WelcomeScreen addNewNode={addNewNode} />}
            <ResizablePanel>
              <Suspense
                fallback={
                  <Stack
                    direction="row"
                    flex="auto"
                    alignItems="center"
                    justifyContent="center"
                    fullHeight
                    fullWidth
                    style={{
                      backgroundColor:
                        theme.palette.background[prefersDarkMode ? "default" : "paper"],
                    }}
                  >
                    <CircularProgress size={28} />
                  </Stack>
                }
              >
                {editorForStorybook ?? (
                  <Editor
                    autoFormatOnSave={autoFormatOnSave}
                    script={currentScript}
                    setScriptCode={setScriptCode}
                    setScriptOverride={setScriptOverride}
                    rosLib={rosLib}
                    typesLib={typesLib}
                    save={saveNode}
                  />
                )}
              </Suspense>
            </ResizablePanel>
            <PanelResizeHandle className={classes.resizeHandle} />
            <ResizablePanel
              collapsible
              minSize={38}
              collapsedSize={38}
              defaultSize={38}
              ref={bottomBarRef}
            >
              <BottomBar
                diagnostics={selectedNodeDiagnostics}
                isSaved={isNodeSaved}
                logs={selectedNodeLogs}
                nodeId={selectedNodeId}
                onChangeTab={onChangeBottomBarTab}
                save={() => {
                  saveNode(currentScript?.code);
                }}
              />
            </ResizablePanel>
          </PanelGroup>
        </Stack>
      </Stack>
    </Stack>
  );
}

const defaultConfig: Config = {
  selectedNodeId: undefined,
  autoFormatOnSave: true,
};
export default Panel(
  Object.assign(NodePlayground, {
    panelType: "NodePlayground",
    defaultConfig,
  }),
);
