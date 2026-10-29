import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { embedUrl, splitRows, ytSections } from "./panelLogic.ts";

describe("youtube panelLogic", () => {
  it("embedUrl validates the id", () => {
    assert.equal(embedUrl("dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
    assert.equal(embedUrl("../x\"onload"), null);
  });
  it("splitRows routes by kind", () => {
    const r = splitRows([
      { kind: "video", video_id: "a", channel_id: "c", channel_title: "C", title: "t", published_at: null },
      { kind: "watched", video_id: "b", channel_id: null, title: "u", last_at: "2026-10-01 00:00:00", first_at: "2026-09-01 00:00:00", watch_count: 3 },
      { kind: "later", video_id: "l", channel_id: "c", title: "q", added_at: "x" },
      { kind: "signal", target_kind: "channel", target_id: "c", signal: "hide", title: "" },
      { kind: "channel", channel_id: "c", title: "C", handle: "@c" },
      { kind: "other" },
    ]);
    assert.equal(r.videos[0].channel, "C");
    assert.equal(r.watched[0].channelId, null);
    assert.equal(r.channels[0].handle, "@c");
    assert.deepEqual(r.watched[0], { videoId: "b", channelId: null, title: "u", watchedAt: "2026-10-01 00:00:00", firstAt: "2026-09-01 00:00:00", count: 3 });
    assert.equal(r.later[0].videoId, "l");
    assert.deepEqual([r.signals[0].kind, r.signals[0].signal], ["channel", "hide"]);
  });
});

describe("youtube sections parity", () => {
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, ytSections.map((x) => x.id).sort());
  });
});

describe("youtube manifest", () => {
  it("registers every skill the panel and chat button call", () => {
    const idx = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    for (const n of ["add_channel", "remove_channel", "refresh_feeds", "mark_watched", "clear_history", "import_history", "add_later", "remove_later", "set_signal", "clear_signal", "clear_hidden"])
      assert.match(idx, new RegExp(`name: "${n}"`), n);
  });
});
