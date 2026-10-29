import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAction, cardActions, postKey, withReply } from "./actionLogic.ts";
import { rowToPost, socialOptions, type FeedPost } from "./panelLogic.ts";

const P: FeedPost = {
  platform: "bluesky", postId: "u", name: "A", handle: "a", avatar: null, text: "t", link: null, media: [],
  likes: 3, reposts: null, replies: 0, postedAt: null, meta: { cid: "c" },
};

describe("action logic", () => {
  it("like/unlike adjusts the count and flag, never below 0", () => {
    const l = applyAction(P, "like");
    assert.deepEqual([l.likes, l.meta.liked, l.meta.cid], [4, true, "c"]);
    assert.equal(applyAction({ ...P, likes: 0 }, "unlike").likes, 0);
    assert.equal(applyAction(l, "unlike").meta.liked, false);
  });
  it("share leaves unknown counts null", () => {
    const s = applyAction(P, "share");
    assert.deepEqual([s.reposts, s.meta.shared], [null, true]);
    assert.equal(applyAction({ ...P, reposts: 2 }, "share").reposts, 3);
  });
  it("applyAction does not mutate (rollback = keep the old object)", () => {
    applyAction(P, "like");
    assert.equal(P.likes, 3);
  });
  it("reply bumps replies", () => assert.equal(withReply(P).replies, 1));
  it("cardActions needs setting + connected + capability", () => {
    const s = { connected: true, can: { like: true, share: false, reply: true } };
    assert.deepEqual(cardActions(s, true), { like: true, share: false, reply: true });
    assert.deepEqual(cardActions(s, false), { like: false, share: false, reply: false });
    assert.equal(cardActions({ ...s, connected: false }, true).like, false);
    assert.equal(cardActions(undefined, true).like, false);
  });
  it("rowToPost parses meta, tolerating junk; keys and option exist", () => {
    assert.deepEqual(rowToPost({ platform: "p", post_id: "1", meta: '{"liked":true}' }).meta, { liked: true });
    assert.deepEqual(rowToPost({ platform: "p", post_id: "1", meta: "nope" }).meta, {});
    assert.deepEqual(rowToPost({ platform: "p", post_id: "1" }).meta, {});
    assert.equal(postKey(P), "bluesky\u0000u");
    assert.ok(socialOptions.some((o) => o.key === "showActions"));
  });
});
