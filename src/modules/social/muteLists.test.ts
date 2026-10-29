import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMutes, inList, toLists, toMutes } from "./muteLists.ts";
import { parseBskyNotifications, parseMastoMentions } from "./connectors/inboxParse.ts";
import type { FeedPost } from "./panelLogic.ts";

const post = (platform: string, handle: string, text: string): FeedPost => ({ platform, postId: handle + text, name: handle, handle, avatar: null, text, link: null, media: [], likes: null, reposts: null, replies: null, postedAt: null, meta: {} });

test("mutes drop accounts and whole words", () => {
  const m = toMutes([{ kind: "word", value: "Crypto" }, { kind: "account", value: "bluesky:spam.bsky.social" }, { kind: "account", value: "troll" }]);
  const ps = [post("bluesky", "@Spam.bsky.social", "hi"), post("mastodon", "troll", "x"), post("reddit", "u/a", "cryptography"), post("reddit", "u/b", "buy crypto!")];
  assert.deepEqual(applyMutes(ps, m).map((p) => p.text), ["cryptography"]);
});

test("lists filter by platform:handle", () => {
  const l = toLists([{ name: "Friends", platform: "mastodon", handle: "@ann@x.social" }]);
  const ps = [post("mastodon", "ann@x.social", "a"), post("bluesky", "ann@x.social", "b")];
  assert.deepEqual(inList(ps, l.get("Friends")).map((p) => p.text), ["a"]);
  assert.equal(inList(ps, undefined).length, 2);
});

test("inbox parsers keep mentions/replies only", () => {
  const masto = parseMastoMentions([{ type: "mention", status: { id: "1", account: { acct: "a", display_name: "A" }, content: "<p>@me hi</p>", created_at: "2026-10-01T00:00:00Z" } }, { type: "favourite" }]);
  assert.equal(masto.length, 1);
  assert.equal(masto[0].text, "@me hi");
  const b = parseBskyNotifications({ notifications: [
    { reason: "reply", uri: "at://d/app.bsky.feed.post/abc", cid: "c", author: { handle: "b.bsky.social" }, record: { text: "yo", createdAt: "2026-10-01T00:00:00Z" } },
    { reason: "like", uri: "at://x", author: { handle: "c" } },
  ] });
  assert.deepEqual(b.map((p) => [p.handle, p.text, p.link]), [["b.bsky.social", "yo", "https://bsky.app/profile/b.bsky.social/post/abc"]]);
});
