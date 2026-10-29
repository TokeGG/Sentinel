import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTakeout } from "./takeout.ts";

const JSON_TEXT = JSON.stringify([
  { header: "YouTube", title: "Watched Cool Video", titleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    subtitles: [{ name: "Chan", url: "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv" }], time: "2026-10-01T12:00:00.000Z" },
  { header: "YouTube", title: "Watched a video that has been removed" },
  { header: "YouTube", title: "Watched Second", titleUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa&t=5", time: "garbage" },
  null,
]);

describe("parseTakeout", () => {
  it("parses watched items and skips ones without a video url", () => {
    const r = parseTakeout(JSON_TEXT);
    assert.equal(r.length, 2);
    assert.deepEqual(r[0], { videoId: "dQw4w9WgXcQ", title: "Cool Video", channelId: "UCabcdefghijklmnopqrstuv", watchedAt: "2026-10-01T12:00:00.000Z" });
    assert.deepEqual(r[1], { videoId: "aaaaaaaaaaa", title: "Second", channelId: null, watchedAt: null });
  });
  it("throws a clear error on bad input", () => {
    assert.throws(() => parseTakeout("nope"), /not valid JSON/);
    assert.throws(() => parseTakeout("{}"), /array/);
  });
});
