import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  composeError, dividerIndex, nameHue, filterPosts, linkify, mergePosts, postAge, rowToPost, socialOptions, socialSections,
  unreadCount, type FeedPost,
} from "./panelLogic.ts";
import { customizeError } from "../../core/customizeChecks.ts";

const P = (platform: string, postId: string, postedAt: string | null, text = "hi"): FeedPost => ({
  platform, postId, name: "Ann", handle: "ann@x", avatar: null, text, link: null, media: [],
  likes: null, reposts: null, replies: null, postedAt, meta: {},
});
const a = P("mastodon", "1", "2026-01-03T00:00:00Z");
const b = P("bluesky", "1", "2026-01-02T00:00:00Z", "Hello World");
const c = P("reddit", "1", "2026-01-01T00:00:00Z");

describe("social panelLogic", () => {
  it("merge sorts newest first, dedupes by platform+id, undated last", () => {
    const undated = P("x", "9", null);
    const m = mergePosts([c, undated], [a, b], [{ ...a, text: "updated" }, P("bluesky", "1", "2026-01-02T00:00:00Z")]);
    assert.deepEqual(m.map((p) => `${p.platform}:${p.postId}`), ["mastodon:1", "bluesky:1", "reddit:1", "x:9"]);
    assert.equal(m[0].text, "updated");
    assert.equal(mergePosts([P("a", "1", "2026-01-01T00:00:00Z")], [P("b", "1", "2026-01-01T00:00:00Z")]).length, 2);
  });
  it("filter by platform chips and search", () => {
    const all = [a, b, c];
    assert.equal(filterPosts(all, [], "").length, 3);
    assert.deepEqual(filterPosts(all, ["reddit", "bluesky"], "").map((p) => p.platform), ["bluesky", "reddit"]);
    assert.deepEqual(filterPosts(all, [], " hello ").map((p) => p.platform), ["bluesky"]);
    assert.equal(filterPosts(all, ["mastodon"], "hello").length, 0);
  });
  it("unread count and divider position", () => {
    const posts = [a, b, c];
    assert.equal(unreadCount(posts, "2026-01-01T12:00:00Z"), 2);
    assert.equal(dividerIndex(posts, "2026-01-01T12:00:00Z"), 2);
    assert.equal(dividerIndex(posts, null), -1);
    assert.equal(unreadCount(posts, null), 0);
    assert.equal(dividerIndex(posts, "2026-02-01T00:00:00Z"), -1); // nothing new
    assert.equal(dividerIndex(posts, "2025-01-01T00:00:00Z"), -1); // everything new: no divider
  });
  it("divider is not placed in a filtered list with no boundary", () => {
    assert.equal(dividerIndex([c], "2026-01-01T12:00:00Z"), -1);
  });
  it("postAge: relative, then date, blank for bad", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    assert.equal(postAge("2026-01-09T21:00:00Z", now), "3h");
    assert.equal(postAge("2026-01-10T00:00:00Z", now), "just now");
    assert.equal(postAge("2026-01-01T00:00:00Z", now), "Jan 1");
    assert.equal(postAge(null, now), "");
    assert.equal(postAge("nope", now), "");
  });
  it("linkify splits links and keeps trailing punctuation as text", () => {
    assert.deepEqual(linkify("see https://a.io/x, ok"), [
      { text: "see " }, { text: "https://a.io/x", url: "https://a.io/x" }, { text: ", ok" },
    ]);
    assert.deepEqual(linkify("plain"), [{ text: "plain" }]);
    assert.deepEqual(linkify("javascript:alert(1)"), [{ text: "javascript:alert(1)" }]);
  });
  it("composeError", () => {
    assert.match(composeError("x", [])!, /account/);
    assert.match(composeError("  ", ["bluesky"])!, /first/);
    assert.match(composeError("x".repeat(301), ["bluesky", "mastodon"])!, /bluesky/);
    assert.equal(composeError("x".repeat(301), ["mastodon"]), null);
  });
  it("rowToPost parses media JSON safely", () => {
    const base = { platform: "x", post_id: "1", name: "n", handle: "h", text: "t", likes: 3, posted_at: "d" };
    assert.deepEqual(rowToPost({ ...base, media: '["https://i/1.png",5]' }).media, ["https://i/1.png"]);
    assert.deepEqual(rowToPost({ ...base, media: "{bad" }).media, []);
    assert.equal(rowToPost(base).likes, 3);
    assert.equal(rowToPost(base).reposts, null);
  });
  it("manifest customize is valid; section ids match Panel.tsx", () => {
    assert.equal(customizeError({ sections: socialSections, options: socialOptions }), null);
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, socialSections.map((s) => s.id).sort());
    for (const o of socialOptions) assert.ok(src.includes(`"${o.key}"`), `Panel reads option ${o.key}`);
  });
});

describe("nameHue", () => {
  it("is stable and within 0-359", () => {
    assert.equal(nameHue("Mara"), nameHue("Mara"));
    assert.ok(nameHue("") >= 0 && nameHue("Tomás") < 360);
  });
});
