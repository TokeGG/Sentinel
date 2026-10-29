import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseYtFeed } from "./feed.ts";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv"/>
 <id>yt:channel:abcdefghijklmnopqrstuv</id>
 <yt:channelId>UCabcdefghijklmnopqrstuv</yt:channelId>
 <title>Cool &amp; Co</title>
 <author><name>Cool &amp; Co</name></author>
 <entry>
  <id>yt:video:dQw4w9WgXcQ</id>
  <yt:videoId>dQw4w9WgXcQ</yt:videoId>
  <yt:channelId>UCabcdefghijklmnopqrstuv</yt:channelId>
  <title>It&#39;s a &quot;test&quot;</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
  <author><name>Cool &amp; Co</name></author>
  <published>2026-10-20T10:00:00+00:00</published>
  <updated>2026-10-21T10:00:00+00:00</updated>
  <media:group><media:title>x</media:title></media:group>
 </entry>
 <entry><yt:videoId>aaaaaaaaaaa</yt:videoId><title>Two</title><published>2026-10-19T10:00:00+00:00</published></entry>
</feed>`;

describe("parseYtFeed", () => {
  it("reads feed head and entries", () => {
    const f = parseYtFeed(XML);
    assert.equal(f.channelId, "UCabcdefghijklmnopqrstuv");
    assert.equal(f.title, "Cool & Co");
    assert.equal(f.videos.length, 2);
    assert.deepEqual(f.videos[0], { videoId: "dQw4w9WgXcQ", title: `It's a "test"`, author: "Cool & Co", publishedAt: "2026-10-20T10:00:00+00:00" });
    assert.equal(f.videos[1].author, null);
  });
  it("empty / non-feed input", () => assert.deepEqual(parseYtFeed("<html/>"), { channelId: null, title: null, videos: [] }));
});
