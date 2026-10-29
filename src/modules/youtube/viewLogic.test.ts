import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Sig } from "./library.ts";
import type { Video } from "./recommend.ts";
import { agoLabel, avatar, chipsFor, filterVideos, fmtDuration, matchWatched, upNext } from "./viewLogic.ts";

const v = (id: string, ch: string, title: string): Video => ({ videoId: id, channelId: ch, channel: `Chan ${ch}`, title, publishedAt: null });
const vids = [v("a", "c1", "Rust async"), v("b", "c2", "Cooking pasta"), v("c", "c1", "Rust macros")];
const f = (over: object) => ({ chip: "all", query: "", seen: new Set<string>(), signals: [] as Sig[], ...over });
const hide = (kind: "video" | "channel", id: string): Sig => ({ kind, id, signal: "hide", channelId: null, title: "", at: null });

describe("viewLogic", () => {
  it("chips: All, one per channel, Unwatched", () => {
    assert.deepEqual(chipsFor([{ channelId: "c1", title: "One", handle: null }]).map((c) => c.id), ["all", "ch:c1", "unwatched"]);
  });
  it("filterVideos by chip, search (title or channel) and hidden", () => {
    assert.equal(filterVideos(vids, f({})).length, 3);
    assert.deepEqual(filterVideos(vids, f({ chip: "ch:c1" })).map((x) => x.videoId), ["a", "c"]);
    assert.deepEqual(filterVideos(vids, f({ chip: "unwatched", seen: new Set(["a"]) })).map((x) => x.videoId), ["b", "c"]);
    assert.deepEqual(filterVideos(vids, f({ query: " PASTA " })).map((x) => x.videoId), ["b"]);
    assert.deepEqual(filterVideos(vids, f({ query: "chan c2" })).map((x) => x.videoId), ["b"]);
    assert.deepEqual(filterVideos(vids, f({ signals: [hide("video", "a")] })).map((x) => x.videoId), ["b", "c"]);
    assert.deepEqual(filterVideos(vids, f({ signals: [hide("channel", "c1")] })).map((x) => x.videoId), ["b"]);
  });
  it("upNext: ranked first, then unwatched latest, no current video, no dupes, limited", () => {
    const out = upNext("a", [vids[2]], vids, new Set(["b"]));
    assert.deepEqual(out.map((x) => x.videoId), ["c"]);
    assert.deepEqual(upNext("zz", [vids[2]], vids, new Set(), 2).map((x) => x.videoId), ["c", "a"]);
  });
  it("matchWatched searches titles", () => {
    const w = [{ videoId: "a", channelId: null, title: "Rust", watchedAt: null, firstAt: null, count: 1 }, { videoId: "b", channelId: null, title: "Go", watchedAt: null, firstAt: null, count: 1 }];
    assert.deepEqual(matchWatched(w, "rus").map((x) => x.videoId), ["a"]);
    assert.equal(matchWatched(w, "").length, 2);
  });
  it("avatar is stable and handles empty names", () => {
    assert.deepEqual(avatar("fireship"), avatar("fireship"));
    assert.equal(avatar("fireship").initial, "F");
    assert.equal(avatar("").initial, "?");
    assert.ok(avatar("x").hue >= 0 && avatar("x").hue < 360);
  });
  it("fmtDuration and agoLabel", () => {
    assert.equal(fmtDuration(83), "1:23");
    assert.equal(fmtDuration(3725), "1:02:05");
    for (const bad of [null, undefined, 0, -3, NaN]) assert.equal(fmtDuration(bad), "");
    assert.deepEqual([agoLabel("3d"), agoLabel("just now"), agoLabel("")], ["3d ago", "just now", ""]);
  });
});
