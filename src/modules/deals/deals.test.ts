import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySignal, emptyProfile, score } from "../../core/taste/model.ts";
import { CATEGORIES, DEFAULT_SOURCES } from "./defaults.ts";
import { dealInfo, percentOff, priceBand, storeOf, tagOf } from "./price.ts";
import { seedIfEmpty, type SeedDb } from "./seed.ts";
import { dealTaste } from "./taste.ts";

describe("price parsing", () => {
  it("was/now gives price, was and computed percent", () => {
    const d = dealInfo("Headphones now $149.99 (was $200)");
    assert.equal(d.price, 149.99);
    assert.equal(d.was, 200);
    assert.equal(d.percent, 25);
    assert.equal(percentOff("Headphones now $149.99 (was $200)"), "-25%");
  });
  it("explicit percent wins; free; bands", () => {
    assert.equal(dealInfo("SSD 40% off $59").percent, 40);
    assert.equal(dealInfo("Free Game: Foo").free, true);
    assert.equal(dealInfo("Free shipping on $20 order").free, false);
    assert.equal(dealInfo("Foo").band, null);
    assert.deepEqual([priceBand(9, false), priceBand(50, false), priceBand(150, false), priceBand(500, false), priceBand(2000, false), priceBand(0, true)],
      ["under-25", "25-100", "100-300", "300-1000", "1000-plus", "free"]);
  });
  it("percentOff still ignores 100% and plain titles", () => {
    assert.equal(percentOff("Save 100% off"), null);
    assert.equal(percentOff("$1,299.99 laptop"), null);
  });
  it("storeOf and tagOf", () => {
    assert.equal(storeOf("[GPU] RTX 4070 - $499 @ Newegg"), "Newegg");
    assert.equal(storeOf("TV $300 at Best Buy"), "Best Buy");
    assert.equal(tagOf("[GPU] RTX 4070"), "GPU");
    assert.equal(tagOf("RTX"), null);
  });
});

describe("default sources + seeding", () => {
  function fake(initial: number) {
    const rows = new Set<string>();
    let count = initial;
    const db: SeedDb = {
      select: async <T,>() => [{ n: count }] as unknown as T,
      execute: async (sql, args) => { if (sql.includes("INTO deal_sources")) { rows.add(String(args![0])); count = rows.size; } },
    };
    return { db, rows };
  }
  it("defaults are unique https urls with valid categories", () => {
    assert.equal(new Set(DEFAULT_SOURCES.map((s) => s.url)).size, DEFAULT_SOURCES.length);
    for (const s of DEFAULT_SOURCES) { assert.match(s.url, /^https:\/\//); assert.ok(CATEGORIES.some((c) => c.id === s.category)); }
  });
  it("seeds an empty table once, never a populated one", async () => {
    const e = fake(0);
    assert.equal(await seedIfEmpty(e.db), true);
    assert.equal(e.rows.size, DEFAULT_SOURCES.length);
    assert.equal(await seedIfEmpty(e.db), false); // now populated
    assert.equal(e.rows.size, DEFAULT_SOURCES.length);
    const user = fake(2);
    assert.equal(await seedIfEmpty(user.db), false);
    assert.equal(user.rows.size, 0);
  });
});

describe("deal taste", () => {
  const row = { id: 1, title: "[GPU] RTX 4070 - $499 @ Newegg", label: "r/buildapcsales", category: "pc" };
  it("features include source, category, store, price band, tag, keywords", () => {
    const f = dealTaste(row).features;
    for (const x of ["src:r/buildapcsales", "cat:pc", "store:newegg", "price:300-1000", "tag:gpu", "kw:rtx"]) assert.ok(f.includes(x), x);
  });
  it("a like raises other deals sharing features above unrelated ones", () => {
    const p = applySignal(applySignal(emptyProfile(), dealTaste(row).features, "like"), dealTaste(row).features, "like");
    const similar = dealTaste({ id: 2, title: "[GPU] RTX 4080 - $899 @ Newegg", label: "r/buildapcsales", category: "pc" });
    const other = dealTaste({ id: 3, title: "Vacuum cleaner $79", label: "r/frugal", category: "home" });
    assert.ok(score(similar, p) > score(other, p));
  });
});
