import { it } from "node:test";
import assert from "node:assert/strict";
import { mergeNew } from "./newFeed.ts";

it("merges the three sources newest first and drops bad entries", () => {
  const out = mergeNew(
    [{ video_id: "abcdefghijk", title: "Vid", published_at: "2026-10-30T10:00:00Z", channel_title: "Ch" }, { video_id: "bad", title: "x", published_at: null }],
    [{ login: "streamer", name: "Streamer", title: "Live!", startedAt: "2026-10-30T12:00:00Z" }],
    [{ id: 4, title: "Ep 1", published_at: "2026-10-30T11:00:00Z", audio_url: "https://a.b/1.mp3", label: "Pod" }, { id: 5, title: "x", published_at: null, audio_url: "http://insecure" }],
  );
  assert.deepEqual(out.map((i) => i.kind), ["live", "podcast", "youtube"]);
  assert.equal(out[2].url, "https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(out[0].url, "https://www.twitch.tv/streamer");
});
it("respects the limit", () => {
  const yt = Array.from({ length: 5 }, (_, i) => ({ video_id: `abcdefghij${i}`, title: "", published_at: null }));
  assert.equal(mergeNew(yt, [], [], 3).length, 3);
});
