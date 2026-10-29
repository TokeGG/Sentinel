import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkVerdict, countBy, filterRows, mergeRows, parseState, pool, seedPlan } from "./logic.ts";
import { NEWS_CATALOG, NEWS_CATEGORIES } from "../catalog/index.ts";

const RSS = "<rss><channel><item><title>A</title><link>https://x/1</link><guid>1</guid></item></channel></rss>";

describe("source catalog logic", () => {
  it("parseState tolerates junk", () => {
    assert.deepEqual(parseState("nope"), {});
    assert.deepEqual(parseState("[1]"), {});
    assert.deepEqual(parseState('{"u":{"off":true}}'), { u: { off: true } });
  });
  it("seedPlan skips existing, removed and repeated urls", () => {
    const cat = [{ url: "a", label: "A", category: "x" }, { url: "b", label: "B", category: "x" }, { url: "c", label: "C", category: "x" }, { url: "c", label: "C2", category: "y" }];
    assert.deepEqual(seedPlan(cat, ["a"], { b: { removed: true } }).map((c) => c.label), ["C"]);
  });
  it("checkVerdict: working only for 2xx with items", () => {
    assert.equal(checkVerdict(200, RSS).status, "working");
    assert.deepEqual(checkVerdict(404, RSS), { status: "broken", err: "HTTP 404" });
    assert.equal(checkVerdict(200, "<html><body>hi</body></html>").err, "HTML page, not a feed");
    assert.equal(checkVerdict(200, "<rss></rss>").err, "no feed items");
  });
  it("mergeRows/filterRows: status defaults to unverified, off and table enabled both count", () => {
    const rows = mergeRows([{ id: 1, url: "a", label: null, category: "tech" }, { id: 2, url: "b", label: "B", enabled: 0 }, { id: 3, url: "c", label: "C", enabled: 1 }],
      { a: { status: "working" }, c: { off: true, status: "broken", err: "HTTP 500" } });
    assert.deepEqual(rows.map((r) => [r.enabled, r.status, r.category]), [[true, "working", "tech"], [false, "unverified", "other"], [false, "broken", "other"]]);
    assert.equal(filterRows(rows, "other", "broken").length, 1);
    assert.equal(countBy(rows, "unverified"), 1);
  });
  it("pool runs everything with bounded concurrency", async () => {
    let live = 0, max = 0;
    const done: number[] = [];
    await pool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => { live++; max = Math.max(max, live); await new Promise((r) => setTimeout(r, 2)); done.push(n); live--; });
    assert.equal(done.length, 7);
    assert.ok(max <= 3);
  });
  it("news catalog: >= 25 per category, unique http(s) urls, labels", () => {
    for (const c of NEWS_CATEGORIES) assert.ok(c.feeds.length >= 25, c.id);
    assert.equal(new Set(NEWS_CATALOG.map((c) => c.url)).size, NEWS_CATALOG.length);
    for (const c of NEWS_CATALOG) { assert.match(c.url, /^https?:\/\/[^\s]+$/); assert.ok(c.label); }
  });
});
