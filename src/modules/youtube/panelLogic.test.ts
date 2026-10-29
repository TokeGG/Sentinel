import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { embedUrl, recommend, splitRows, tokenize, ytSections, type Video, type Watched } from "./panelLogic.ts";

const NOW = Date.parse("2026-10-29T00:00:00Z");
const v = (id: string, channelId: string, title: string, publishedAt = "2026-10-28T00:00:00Z"): Video => ({ videoId: id, channelId, channel: channelId, title, publishedAt });
const w = (id: string, channelId: string | null, title: string, watchedAt = "2026-10-27 00:00:00"): Watched => ({ videoId: id, channelId, title, watchedAt });

describe("youtube panelLogic", () => {
  it("tokenize drops stopwords, short words, numbers, dupes", () => {
    assert.deepEqual(tokenize("The Rust Rust 2026 guide: how to Build"), ["rust", "guide", "build"]);
  });
  it("embedUrl validates the id", () => {
    assert.equal(embedUrl("dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
    assert.equal(embedUrl("../x\"onload"), null);
  });
  it("splitRows routes by kind", () => {
    const r = splitRows([
      { kind: "video", video_id: "a", channel_id: "c", channel_title: "C", title: "t", published_at: null },
      { kind: "watched", video_id: "b", channel_id: null, title: "u", watched_at: "x" },
      { kind: "channel", channel_id: "c", title: "C", handle: "@c" },
      { kind: "other" },
    ]);
    assert.equal(r.videos[0].channel, "C");
    assert.equal(r.watched[0].channelId, null);
    assert.equal(r.channels[0].handle, "@c");
  });
  it("recommend excludes watched videos", () => {
    const out = recommend([v("a", "c1", "Rust async"), v("b", "c1", "Other")], [w("a", "c1", "Rust async")], NOW);
    assert.deepEqual(out.map((x) => x.videoId), ["b"]);
  });
  it("recommend prefers watched channels", () => {
    const out = recommend([v("a", "c2", "Cooking pasta"), v("b", "c1", "Gardening tips")], [w("x", "c1", "Something else"), w("y", "c1", "More")], NOW);
    assert.equal(out[0].videoId, "b");
    assert.equal(out[0].why, "a channel you watch");
  });
  it("recommend uses title keyword overlap", () => {
    const out = recommend([v("a", "c2", "Cooking pasta"), v("b", "c3", "Rust compiler internals")], [w("x", null, "Learning Rust compiler")], NOW);
    assert.equal(out[0].videoId, "b");
    assert.equal(out[0].why, "similar to what you watched");
  });
  it("recent watches outweigh old ones", () => {
    const hist = [w("x", "old", "a", "2024-01-01 00:00:00"), w("y", "new", "b", "2026-10-28 00:00:00")];
    const out = recommend([v("a", "old", "zzz"), v("b", "new", "zzz")], hist, NOW);
    assert.equal(out[0].channelId, "new");
  });
  it("cold start falls back to newest first and respects limit", () => {
    const out = recommend([v("a", "c", "x1", "2026-10-01T00:00:00Z"), v("b", "c", "x2", "2026-10-28T00:00:00Z")], [], NOW, 1);
    assert.deepEqual(out.map((x) => x.videoId), ["b"]);
    assert.equal(out[0].why, "new");
  });
});

describe("youtube sections parity", () => {
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, ytSections.map((x) => x.id).sort());
  });
});
