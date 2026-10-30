import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { htmlToText, parseBluesky, parseMastodon, parseReddit } from "./parse.ts";

describe("social connector parsing", () => {
  it("htmlToText keeps breaks and decodes entities", () => {
    assert.equal(htmlToText("<p>a &amp; b<br>c</p><p>d</p>"), "a & b\nc\n\nd");
  });
  it("bluesky maps author, media, counts; drops non-https images", () => {
    const [p] = parseBluesky({ feed: [{ post: {
      uri: "at://did:plc:1/app.bsky.feed.post/3k", author: { handle: "a.bsky.social", displayName: "Ann", avatar: "https://cdn/a.jpg" },
      record: { text: "yo", createdAt: "2026-01-01T00:00:00.000Z" },
      embed: { media: { images: [{ thumb: "https://cdn/t.jpg" }, { thumb: "javascript:x" }] } },
      cid: "bafy", viewer: { like: "at://did:plc:1/app.bsky.feed.like/l1" },
      likeCount: 4, repostCount: 1, replyCount: 0,
    } }] });
    assert.equal(p.name, "Ann");
    assert.equal(p.link, "https://bsky.app/profile/a.bsky.social/post/3k");
    assert.deepEqual(p.media, ["https://cdn/t.jpg"]);
    assert.deepEqual([p.likes, p.reposts, p.replies], [4, 1, 0]);
    assert.deepEqual(p.meta, {
      cid: "bafy", rootUri: "at://did:plc:1/app.bsky.feed.post/3k", rootCid: "bafy",
      liked: true, likeUri: "at://did:plc:1/app.bsky.feed.like/l1", shared: false, shareUri: undefined,
    });
  });
  it("mastodon unwraps boosts and keeps only image previews", () => {
    const [p] = parseMastodon([{ id: "9", account: { acct: "b" }, reblog: {
      id: "5", favourited: true, account: { acct: "o@x.social", display_name: "Orig", avatar: "https://a/1.png" }, content: "<p>hey</p>", url: "https://x.social/1",
      created_at: "2026-01-01T00:00:00Z", favourites_count: 2, reblogs_count: 3, replies_count: 1,
      media_attachments: [{ type: "image", preview_url: "https://m/1.png" }, { type: "video", preview_url: "https://m/2.png" }],
    } }]);
    assert.equal(p.postId, "9");
    assert.equal(p.name, "Orig");
    assert.equal(p.text, "hey");
    assert.deepEqual(p.media, ["https://m/1.png"]);
    assert.equal(p.reposts, 3);
    assert.deepEqual(p.meta, { targetId: "5", liked: true, shared: false, repost: true });
  });
  it("reddit maps subreddit/author and epoch seconds", () => {
    const [p] = parseReddit({ data: { children: [{ data: { id: "z", author: "u1", subreddit: "rust", title: "T", permalink: "/r/rust/z", created_utc: 1767225600, score: 10, num_comments: 2, thumbnail: "self" } }] } });
    assert.equal(p.name, "r/rust");
    assert.equal(p.postedAt, "2026-01-01T00:00:00.000Z");
    assert.deepEqual(p.media, []);
    assert.equal(p.replies, 2);
    assert.deepEqual(p.meta, { liked: false });
  });
});
