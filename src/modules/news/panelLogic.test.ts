import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feedSections, filterBySource, sourceLabel, sourcesOf } from "./panelLogic.ts";

const rows = [
  { id: 1, label: "Zed" },
  { id: 2, label: "Alpha" },
  { id: 3, label: "Zed" },
  { id: 4, label: null },
  { id: 5, label: "" },
];

describe("news panelLogic", () => {
  it("sourcesOf is unique, sorted, ignores blank labels", () => {
    assert.deepEqual(sourcesOf(rows), ["Alpha", "Zed"]);
  });
  it("filterBySource filters, null means all", () => {
    assert.deepEqual(filterBySource(rows, "Zed").map((r) => r.id), [1, 3]);
    assert.equal(filterBySource(rows, null).length, 5);
    assert.deepEqual(filterBySource(rows, "nope"), []);
  });
  it("sourceLabel: label, else source host without www, else link host, else url, else empty", () => {
    assert.equal(sourceLabel({ label: "Rust Blog", source_url: "https://a.com/f" }), "Rust Blog");
    assert.equal(sourceLabel({ label: "  ", source_url: "https://www.example.com/feed.xml" }), "example.com");
    assert.equal(sourceLabel({ label: null, source_url: "https://blog.rust-lang.org/feed.xml" }), "blog.rust-lang.org");
    assert.equal(sourceLabel({ label: null, source_url: null, link: "https://www.news.test/a/1" }), "news.test");
    assert.equal(sourceLabel({ label: null, source_url: "not a url" }), "not a url");
    assert.equal(sourceLabel({ id: 1 }), "");
  });
  it("derived labels drive sourcesOf and filterBySource", () => {
    const r = [
      { id: 1, label: null, source_url: "https://www.b.com/rss" },
      { id: 2, label: null, source_url: "https://a.com/rss" },
      { id: 3, label: null, source_url: "https://b.com/other" },
    ];
    assert.deepEqual(sourcesOf(r), ["a.com", "b.com"]);
    assert.deepEqual(filterBySource(r, "b.com").map((x) => x.id), [1, 3]);
  });
  it("feedSections declares add, filters, list, status in default order", () => {
    assert.deepEqual(feedSections("headlines", "Headlines").map((s) => s.id), ["add", "filters", "headlines", "status"]);
  });
});

describe("news feed section parity", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
  it("FeedPanel sections, Panel listId and index feedSections agree", () => {
    const feed = read("../news/FeedPanel.tsx");
    const literal = [...feed.matchAll(/<Section\s+id="([^"]+)"/g)].map((x) => x[1]).sort();
    const declared = feedSections("x", "y").map((s) => s.id).filter((i) => i !== "x").sort();
    assert.deepEqual(literal, declared, "news/FeedPanel.tsx literal <Section id> vs feedSections() ids");
    assert.ok(/<Section\s+id=\{listId\}/.test(feed), "news/FeedPanel.tsx must render <Section id={listId}>");
    const panelId = read("./Panel.tsx").match(/listId\s*=\s*"([^"]+)"/)?.[1];
    const indexId = read("./index.ts").match(/feedSections\(\s*"([^"]+)"/)?.[1];
    assert.equal(panelId, "headlines", "news/Panel.tsx listId");
    assert.equal(indexId, "headlines", "news/index.ts feedSections first argument");
    assert.equal(panelId, indexId, "news: Panel.tsx listId vs index.ts feedSections id");
  });
});
