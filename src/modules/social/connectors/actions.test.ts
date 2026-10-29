import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bskyCreatedUri, bskyDelete, bskyLike, bskyReply, bskyRepost, mastoPatch, mastoReplyBody, mastoUrl,
  redditCommentBody, redditCommentError, redditVoteBody,
} from "./actions.ts";

const now = "2026-01-01T00:00:00.000Z";
const ref = (meta = {}) => ({ postId: "at://did:x/app.bsky.feed.post/3k", meta: { cid: "bafy", ...meta } });

describe("bluesky actions", () => {
  it("like and repost records", () => {
    assert.deepEqual(bskyLike("did:me", ref(), now), {
      repo: "did:me", collection: "app.bsky.feed.like",
      record: { $type: "app.bsky.feed.like", createdAt: now, subject: { uri: ref().postId, cid: "bafy" } },
    });
    assert.equal(bskyRepost("did:me", ref(), now).collection, "app.bsky.feed.repost");
  });
  it("reply uses the thread root, or the parent when it is the root", () => {
    const own = bskyReply("did:me", ref(), "hi", now).record as { reply: { root: unknown; parent: unknown }; text: string };
    assert.equal(own.text, "hi");
    assert.deepEqual(own.reply.root, own.reply.parent);
    const deep = bskyReply("did:me", ref({ rootUri: "at://r/app.bsky.feed.post/1", rootCid: "rc" }), "x", now).record as typeof own;
    assert.deepEqual(deep.reply.root, { uri: "at://r/app.bsky.feed.post/1", cid: "rc" });
    assert.equal((deep.reply.parent as { cid: string }).cid, "bafy");
  });
  it("missing cid asks for a refresh", () => {
    assert.throws(() => bskyLike("d", { postId: "at://x/y/z", meta: {} }, now), /Refresh/);
  });
  it("delete splits the record uri", () => {
    assert.deepEqual(bskyDelete("did:me", "at://did:me/app.bsky.feed.like/abc"), { repo: "did:me", collection: "app.bsky.feed.like", rkey: "abc" });
    assert.throws(() => bskyDelete("d", undefined), /Refresh/);
    assert.throws(() => bskyDelete("d", "nonsense"), /bad record/);
  });
  it("created uri parsing", () => {
    assert.equal(bskyCreatedUri({ uri: "at://a/b/c", cid: "x" }), "at://a/b/c");
    assert.throws(() => bskyCreatedUri({}), /no record uri/);
  });
});

describe("mastodon actions", () => {
  const p = { postId: "10", meta: { targetId: "7" } };
  it("urls target the original status of a boost", () => {
    assert.equal(mastoUrl("https://m.s/", p, "favourite"), "https://m.s/api/v1/statuses/7/favourite");
    assert.equal(mastoUrl("https://m.s", { postId: "10", meta: {} }, "unreblog"), "https://m.s/api/v1/statuses/10/unreblog");
  });
  it("reply body and patches", () => {
    assert.deepEqual(mastoReplyBody(p, "yo"), { status: "yo", in_reply_to_id: "7" });
    assert.deepEqual(mastoPatch("unfavourite"), { liked: false });
    assert.deepEqual(mastoPatch("reblog"), { shared: true });
  });
});

describe("reddit actions", () => {
  it("vote and comment bodies use the t3_ fullname", () => {
    assert.equal(redditVoteBody({ postId: "abc", meta: {} }, 1), "id=t3_abc&dir=1");
    assert.equal(redditVoteBody({ postId: "t3_abc", meta: {} }, 0), "id=t3_abc&dir=0");
    assert.equal(redditCommentBody({ postId: "abc", meta: {} }, "a b"), "api_type=json&thing_id=t3_abc&text=a+b");
  });
  it("comment errors come from the body", () => {
    assert.equal(redditCommentError({ json: { errors: [] } }), null);
    assert.equal(redditCommentError({ json: { errors: [["RATELIMIT", "slow down", "ratelimit"]] } }), "slow down");
    assert.equal(redditCommentError(null), null);
  });
});
