// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import moment from "moment";
import { useEffect, useRef } from "react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { formatDuration } from "@foxglove/studio-base/util/formatTime";

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;

export function Uptime(): JSX.Element | ReactNull {
  const startTime = useMessagePipeline(selectStartTime);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const theme = useTheme();

  const timeRef = useRef<HTMLDivElement>(ReactNull);

  // We bypass react and update the DOM elements directly for better performance here.
  useEffect(() => {
    if (!timeRef.current) {
      return;
    }
    if (startTime == undefined) {
      timeRef.current.innerText = "";
      return;
    }

    const uptimeSec = (currentTime?.sec ?? 0) - startTime.sec;
    const uptimeFormatted = formatDurationCustom(uptimeSec * 1000); // milliseconds

    timeRef.current.innerText = `(${uptimeFormatted})`;
  }, [startTime, currentTime]);

  return (
    <div
      style={{ fontFeatureSettings: `${theme.typography.fontFeatureSettings}, "zero"` }}
      ref={timeRef}
    />
  );
}

function formatDurationCustom(duration: number) {
  // Create a duration object from the given milliseconds
  const dur = moment.duration(duration);

  // Build the format string based on the duration values
  let formatString = "";
  if (dur.hours() > 0) {
    formatString += "h[h] ";
  }
  if (dur.hours() > 0 || dur.minutes() > 0) {
    formatString += "m[m] ";
  }
  formatString += "s[s]";

  // Format and return the duration string
  return dur.format(formatString.trim());
}
