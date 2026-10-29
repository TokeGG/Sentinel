import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Sig, Watched } from "./library.ts";
import { recommend, tokenize, type Video } from "./recommend.ts";

const NOW = Date.parse("2026-10-29T00:00:00Z");
const v = (id: string, channelId: string, title: string, publishedAt = "2026-10-28T00:00:00Z"): Video => ({ videoId: id, channelId, channel: channelId, title, publishedAt });
const w = (id: string, channelId: string | null, title: string, watchedAt = "2026-10-27 00:00:00"): Watched => ({ videoId: id, channelId, title, watchedAt, firstAt: watchedAt, count: 1 });
const sg = (kind: "video" | "channel", id: string, signal: Sig["signal"], channelId: string | null = null, title = ""): Sig => ({ kind, id, signal, channelId, title, at: "2026-10-28 00:00:00" });

describe("tokenize", () => {
  it("drops stopwords, short words, numbers, dupes", () => {
    assert.deepEqual(tokenize("The Rust Rust 2026 guide: how to Build"), ["rust", "guide", "build"]);
  });
});

describe("recommend", () => {
  it("excludes watched videos", () => {
    const out = recommend([v("a", "c1", "Rust async"), v("b", "c1", "Other")], [w("a", "c1", "Rust async")], NOW);
    assert.deepEqual(out.map((x) => x.videoId), ["b"]);
  });
  it("prefers watched channels", () => {
    const out = recommend([v("a", "c2", "Cooking pasta"), v("b", "c1", "Gardening tips")], [w("x", "c1", "Something else"), w("y", "c1", "More")], NOW);
    assert.equal(out[0].videoId, "b");
    assert.equal(out[0].why, "a channel you watch");
  });
  it("uses title keyword overlap", () => {
    const out = recommend([v("a", "c2", "Cooking pasta"), v("b", "c3", "Rust compiler internals")], [w("x", null, "Learning Rust compiler")], NOW);
    assert.equal(out[0].videoId, "b");
    assert.equal(out[0].why, "similar to what you watched");
  });
  it("recent watches outweigh old ones", () => {
    const hist = [w("x", "old", "a", "2024-01-01 00:00:00"), w("y", "new", "b", "2026-10-28 00:00:00")];
    assert.equal(recommend([v("a", "old", "zzz"), v("b", "new", "zzz")], hist, NOW)[0].channelId, "new");
  });
  it("cold start falls back to newest first and respects limit", () => {
    const out = recommend([v("a", "c", "x1", "2026-10-01T00:00:00Z"), v("b", "c", "x2", "2026-10-28T00:00:00Z")], [], NOW, 1);
    assert.deepEqual(out.map((x) => x.videoId), ["b"]);
    assert.equal(out[0].why, "new");
  });
  it("counts a video once even if history has duplicate rows", () => {
    const vids = [v("a", "c1", "alpha tutorial"), v("b", "c2", "beta tutorial")];
    const once = recommend(vids, [w("x", "c1", "alpha basics"), w("y", "c2", "beta basics")], NOW);
    const dup = recommend(vids, [w("x", "c1", "alpha basics"), w("x", "c1", "alpha basics"), w("x", "c1", "alpha basics"), w("y", "c2", "beta basics")], NOW);
    assert.deepEqual(dup.map((s) => [s.videoId, s.score]), once.map((s) => [s.videoId, s.score]));
  });
});

describe("recommend signals", () => {
  const vids = [v("a", "c1", "Rust async deep dive"), v("b", "c2", "Rust async tips")];
  const hist = [w("x", "c1", "Rust basics"), w("y", "c2", "Rust intro")];
  it("not-interested hides that video and a hidden channel hides all its videos", () => {
    assert.deepEqual(recommend(vids, hist, NOW, 8, [sg("video", "a", "hide", "c1", "Rust async deep dive")]).map((x) => x.videoId), ["b"]);
    assert.deepEqual(recommend(vids, hist, NOW, 8, [sg("channel", "c2", "hide")]).map((x) => x.videoId), ["a"]);
  });
  it("a hide/dislike subtracts from similar videos and the same channel", () => {
    const more = [v("a", "c1", "Cooking pasta"), v("b", "c2", "Cooking pasta"), v("c", "c1", "Gardening")];
    const base = recommend(more, [], NOW).find((s) => s.videoId === "c")!.score;
    const hit = recommend(more, [], NOW, 8, [sg("video", "a", "hide", "c1", "Cooking pasta")]);
    assert.ok(hit.find((s) => s.videoId === "c")!.score < base, "same channel penalised");
    const dis = recommend([v("p", "c9", "Cooking pasta"), v("q", "c8", "Gardening")], [], NOW, 8, [sg("video", "z", "dislike", "c7", "Cooking pasta")]);
    assert.equal(dis[0].videoId, "q", "keyword overlap with a disliked title ranks lower");
  });
  it("a like boosts that channel and its keywords", () => {
    const out = recommend([v("p", "c9", "Cooking pasta"), v("q", "c8", "Gardening")], [], NOW, 8, [sg("video", "z", "like", "c9", "Cooking pasta tips")]);
    assert.equal(out[0].videoId, "p");
  });
});
