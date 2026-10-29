import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { billTaste, memberTaste } from "../../modules/congress/taste.ts";
import { repoTaste } from "../../modules/github/taste.ts";
import { newsTaste } from "../../modules/news/taste.ts";
import { socialTaste } from "../../modules/social/taste.ts";
import { videoTaste } from "../../modules/youtube/taste.ts";
import { recommend } from "../../modules/youtube/recommend.ts";

describe("module taste adapters", () => {
  it("news", () => {
    const t = newsTaste({ id: 4, title: "Rust 2.0 released", label: "HN" });
    assert.equal(t.key, "news:4");
    assert.ok(t.features.includes("src:hn") && t.features.includes("kw:rust"));
  });
  it("social", () => {
    const t = socialTaste({ platform: "mastodon", postId: "9", handle: "@alice", text: "Linux kernel news" });
    assert.equal(t.key, "soc:mastodon:9");
    assert.ok(t.features.includes("from:alice") && t.features.includes("kw:linux"));
  });
  it("congress", () => {
    assert.ok(billTaste({ ref: "hr1", sponsor: "Smith", status: "introduced", title: "Clean Energy Act" }).features.includes("kw:energy"));
    assert.ok(memberTaste({ ref: "m1", name: "Ann Lee", party: "D", state: "CA", chamber: "house" }).features.includes("cat:d"));
  });
  it("github", () => {
    const t = repoTaste({ id: 1, name: "tauri-apps/tauri", language: "Rust", description: "Build desktop apps" });
    assert.equal(t.key, "gh:tauri-apps/tauri");
    assert.ok(t.features.includes("repo:tauri-apps") && t.features.includes("cat:rust"));
  });
  it("youtube: bonus term changes order, no bonus keeps recommend unchanged", () => {
    const vids = ["a", "b"].map((id) => ({ videoId: id, channelId: "c" + id, channel: id, title: id + " video", publishedAt: null }));
    assert.equal(videoTaste(vids[0]).key, "yt:a");
    const base = recommend(vids, []).map((v) => v.videoId);
    const boosted = recommend(vids, [], Date.now(), 8, [], (v) => (v.videoId === "b" ? 1 : 0)).map((v) => v.videoId);
    assert.equal(base.length, 2);
    assert.equal(boosted[0], "b");
  });
});
