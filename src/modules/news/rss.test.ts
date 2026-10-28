import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "./rss.ts";

const RSS_SAMPLE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example Feed</title>
  <item>
    <title>First &amp; Best Post</title>
    <link>https://example.com/1</link>
    <guid>https://example.com/1</guid>
    <pubDate>Mon, 26 Oct 2026 12:00:00 GMT</pubDate>
  </item>
  <item>
    <title><![CDATA[CDATA Title]]></title>
    <link>https://example.com/2</link>
    <guid>guid-2</guid>
  </item>
</channel></rss>`;

const ATOM_SAMPLE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom Entry</title>
    <id>urn:uuid:abc</id>
    <link href="https://example.com/atom/1"/>
    <updated>2026-10-26T12:00:00Z</updated>
  </entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS 2.0 items, decoding entities and CDATA", () => {
    const items = parseFeed(RSS_SAMPLE);
    assert.equal(items.length, 2);
    assert.equal(items[0].title, "First & Best Post");
    assert.equal(items[0].guid, "https://example.com/1");
    assert.equal(items[0].publishedAt, "Mon, 26 Oct 2026 12:00:00 GMT");
    assert.equal(items[1].title, "CDATA Title");
    assert.equal(items[1].guid, "guid-2");
  });

  it("falls back to the link as guid when no guid tag is present", () => {
    const items = parseFeed(
      "<rss><channel><item><title>T</title><link>https://x/y</link></item></channel></rss>"
    );
    assert.equal(items[0].guid, "https://x/y");
  });

  it("parses Atom entries", () => {
    const items = parseFeed(ATOM_SAMPLE);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Atom Entry");
    assert.equal(items[0].guid, "urn:uuid:abc");
    assert.equal(items[0].link, "https://example.com/atom/1");
  });

  it("returns an empty array for a feed with no items", () => {
    assert.deepEqual(parseFeed("<rss><channel></channel></rss>"), []);
  });
});
