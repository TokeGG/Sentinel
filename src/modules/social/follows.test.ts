import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "./follows.ts";

test("every platform is honest: API platforms list both kinds, the rest open their pages", () => {
  for (const p of F.FOLLOW_PLATFORMS) {
    if (p.following === "none" && p.liked === "none") assert.ok(p.pages?.length && p.pages.every((x) => x.url.startsWith("https://")), p.id);
    assert.ok(p.note.length > 10);
  }
  assert.deepEqual(F.FOLLOW_PLATFORMS.filter((p) => p.following === "none").map((p) => p.id), ["x", "facebook", "instagram"]);
});

test("parsers", () => {
  assert.deepEqual(F.parseTwitchFollowed({ data: [{ broadcaster_login: "abc", broadcaster_name: "Abc", followed_at: "2024-01-02T00:00:00Z" }] }), [{ title: "Abc", subtitle: "2024-01-02", url: "https://www.twitch.tv/abc" }]);
  assert.equal(F.parseYtSubs({ items: [{ snippet: { title: "Ch", resourceId: { channelId: "UCx" } } }] })[0].url, "https://www.youtube.com/channel/UCx");
  assert.equal(F.parseYtLiked({ items: [{ id: "vid", snippet: { title: "T", channelTitle: "C" } }] })[0].url, "https://www.youtube.com/watch?v=vid");
  assert.equal(F.parseRedditSubs({ data: { children: [{ data: { display_name_prefixed: "r/x", url: "/r/x/" } }] } })[0].url, "https://www.reddit.com/r/x/");
  assert.equal(F.parseRedditPosts({ data: { children: [{ data: { title: "P", permalink: "/r/x/comments/1/p/" } }] } })[0].title, "P");
  assert.equal(F.parseMastoAccounts([{ acct: "a@b.c", url: "javascript:x" }])[0].url, null);
  assert.equal(F.parseMastoStatuses([{ content: "<p>Hi <b>there</b></p>", account: { acct: "a" }, url: "https://m.s/1" }])[0].title, "Hi there");
  assert.equal(F.parseBskyFollows({ follows: [{ handle: "h.bsky.social" }] })[0].url, "https://bsky.app/profile/h.bsky.social");
  assert.equal(F.parseBskyLikes({ feed: [{ post: { uri: "at://did/app.bsky.feed.post/3k", author: { handle: "h" }, record: { text: "yo" } } }] })[0].url, "https://bsky.app/profile/h/post/3k");
  assert.equal(F.parseGhRepos([{ full_name: "a/b", html_url: "https://github.com/a/b" }])[0].title, "a/b");
  assert.deepEqual(F.parseGhUsers("bad"), []);
});

test("errors", () => {
  assert.match(F.followError("Reddit", 403), /Connect again/);
  assert.match(F.followError("Twitch", null, "Twitch is not connected. Press Connect in Settings > Accounts."), /not connected/);
  assert.match(F.followError("X", 500), /HTTP 500/);
});
