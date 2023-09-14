// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { VideoPlayer } from ".";

describe("VideoPlayer", () => {
  it("ParseDecoderConfig", () => {
    const config = VideoPlayer.ParseDecoderConfig(
      "video/avc;codec=avc1.64001f;coded_width=1280;coded_height=720;description=aabbcc",
    );
    expect(config).toEqual({
      codec: "avc1.64001f",
      codedWidth: 1280,
      codedHeight: 720,
      description: new Uint8Array([0xaa, 0xbb, 0xcc]),
    });
  });
});
