import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractChannel, feedUrl, parseChannelInput } from "./channelUrl.ts";

const ID = "UCabcdefghijklmnopqrstuv"; // UC + 22
describe("parseChannelInput", () => {
  it("bare id and /channel/ urls resolve directly", () => {
    assert.deepEqual(parseChannelInput(ID), { id: ID });
    assert.deepEqual(parseChannelInput(`https://www.youtube.com/channel/${ID}/videos`), { id: ID });
    assert.deepEqual(parseChannelInput(`youtube.com/channel/${ID}`), { id: ID });
  });
  it("handles", () => {
    assert.deepEqual(parseChannelInput("@Foo.Bar"), { pageUrl: "https://www.youtube.com/@Foo.Bar", handle: "@Foo.Bar" });
    assert.deepEqual(parseChannelInput("https://m.youtube.com/@foo/featured"), { pageUrl: "https://www.youtube.com/@foo", handle: "@foo" });
  });
  it("/c/ and /user/", () => {
    assert.deepEqual(parseChannelInput("https://www.youtube.com/c/Name"), { pageUrl: "https://www.youtube.com/c/Name" });
    assert.deepEqual(parseChannelInput("https://youtube.com/user/old"), { pageUrl: "https://www.youtube.com/user/old" });
  });
  it("video urls point at the watch page", () => {
    const w = { pageUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
    assert.deepEqual(parseChannelInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3"), w);
    assert.deepEqual(parseChannelInput("https://youtu.be/dQw4w9WgXcQ"), w);
    assert.deepEqual(parseChannelInput("https://www.youtube.com/shorts/dQw4w9WgXcQ"), w);
  });
  it("rejects junk and other hosts", () => {
    for (const x of ["", "hello world", "https://example.com/@foo", "https://www.youtube.com/", "UCshort", "https://www.youtube.com/watch?v=bad"])
      assert.equal(parseChannelInput(x), null, x);
  });
  it("feedUrl", () => assert.match(feedUrl(ID), /videos\.xml\?channel_id=UC/));
});

describe("extractChannel", () => {
  it("canonical link + og:title", () => {
    const h = `<meta property="og:title" content="Tom &amp; Jerry"><link rel="canonical" href="https://www.youtube.com/channel/${ID}">`;
    assert.deepEqual(extractChannel(h), { channelId: ID, title: "Tom & Jerry" });
  });
  it("itemprop, both attribute orders", () => {
    assert.equal(extractChannel(`<meta itemprop="channelId" content="${ID}">`)?.channelId, ID);
    assert.equal(extractChannel(`<meta content="${ID}" itemprop="channelId">`)?.channelId, ID);
  });
  it("json fallbacks and <title>", () => {
    assert.deepEqual(extractChannel(`<title>Cool Chan - YouTube</title>{"externalId":"${ID}"}`), { channelId: ID, title: "Cool Chan" });
    assert.deepEqual(extractChannel(`{"channelId":"${ID}"}`), { channelId: ID, title: null });
  });
  it("null when nothing found", () => assert.equal(extractChannel("<html>consent</html>"), null));
});
