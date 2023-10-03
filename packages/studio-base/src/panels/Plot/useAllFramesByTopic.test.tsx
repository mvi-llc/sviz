/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { Progress } from "@foxglove/studio-base/players/types";
import { mockMessage } from "@foxglove/studio-base/test/mocks/mockMessage";

import { useAllFramesByTopic } from "./useAllFramesByTopic";

describe("useAllFramesByTopic", () => {
  it("flattens blocks", () => {
    const initialProgress: Progress = {
      messageCache: {
        blocks: [
          {
            messagesByTopic: {
              topic_a: [mockMessage("message", { topic: "topic_a" })],
            },
            needTopics: new Map(),
            sizeInBytes: 1,
          },
        ],
        startTime: { sec: 0, nsec: 0 },
      },
    };

    const topics = [{ topic: "topic_a" }, { topic: "topic_b" }];

    let progress = initialProgress;
    const { result, rerender } = renderHook(() => useAllFramesByTopic(topics), {
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider progress={progress}>{children}</MockMessagePipelineProvider>
      ),
    });

    expect(result.current).toEqual({
      topic_a: [expect.objectContaining({ topic: "topic_a" })],
    });

    const updatedProgress: Progress = {
      messageCache: {
        blocks: [
          ...(initialProgress.messageCache?.blocks ?? []),
          {
            messagesByTopic: {
              topic_a: [mockMessage("message", { topic: "topic_a" })],
              topic_b: [mockMessage("message", { topic: "topic_b" })],
            },
            sizeInBytes: 1,
            needTopics: new Map(),
          },
        ],
        startTime: { sec: 0, nsec: 0 },
      },
    };

    progress = updatedProgress;
    rerender();

    expect(result.current).toEqual({
      topic_a: [
        expect.objectContaining({ topic: "topic_a" }),
        expect.objectContaining({ topic: "topic_a" }),
      ],
      topic_b: [expect.objectContaining({ topic: "topic_b" })],
    });
  });
});
