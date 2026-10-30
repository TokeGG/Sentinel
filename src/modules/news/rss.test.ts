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

it("enclosure + summary", () => {
  const [i] = parseFeed(`<rss><channel><item><title>Ep 1</title><guid>g</guid><description>&lt;p&gt;Use code SAVE20&lt;/p&gt;</description><enclosure url="https://x.org/e.mp3" length="1" type="audio/mpeg"/></item></channel></rss>`);
  assert.deepEqual(i.enclosure, { url: "https://x.org/e.mp3", type: "audio/mpeg" });
  assert.equal(i.summary, "Use code SAVE20");
});

it("imageOf finds https media, enclosure or inline img", async () => {
  const { imageOf, parseFeed } = await import("./rss.ts");
  assert.equal(imageOf('<item><media:content url="https://a/x.jpg" medium="image"/></item>'), "https://a/x.jpg");
  assert.equal(imageOf('<item><enclosure url="https://a/y.png" type="image/png"/></item>'), "https://a/y.png");
  assert.equal(imageOf('<item><enclosure url="https://a/y.mp3" type="audio/mpeg"/></item>'), null);
  assert.equal(imageOf('<item><description>&lt;img src="https://a/z.gif"&gt; hi</description></item>'), "https://a/z.gif");
  assert.equal(imageOf('<item><media:thumbnail url="http://a/x.jpg"/></item>'), null);
  const [it] = parseFeed('<rss><channel><item><title>T</title><link>https://l</link><description>Body text</description><media:thumbnail url="https://i/t.jpg"/></item></channel></rss>');
  assert.equal(it.image, "https://i/t.jpg");
  assert.equal(it.summary, "Body text");
});
