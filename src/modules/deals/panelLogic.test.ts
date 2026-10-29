import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feedSections } from "../news/panelLogic.ts";
import { percentOff, priceOf, sourcesOf } from "./panelLogic.ts";

describe("deals panelLogic", () => {
  it("priceOf parses common price shapes", () => {
    assert.equal(priceOf("Headphones now $139"), "$139");
    assert.equal(priceOf("Laptop $1,299.99 at Store"), "$1,299.99");
    assert.equal(priceOf("Gift card USD 20 off"), "USD 20");
    assert.equal(priceOf("Free shipping everywhere"), null);
    assert.equal(priceOf(""), null);
  });
  it("priceOf handles $.99, trailing commas and over-precise cents", () => {
    assert.equal(priceOf("only $.99 today"), "$.99");
    assert.equal(priceOf("$1,,, wow"), "$1");
    assert.equal(priceOf("$12.34!"), "$12.34");
    assert.equal(priceOf("$12.345 odd"), null); // ambiguous cents: no price rather than a wrong one
    assert.equal(priceOf("$ and $"), null);
  });
  it("priceOf takes the first price", () => {
    assert.equal(priceOf("$50 (was $80)"), "$50");
  });
  it("sourcesOf is unique and sorted", () => {
    assert.deepEqual(sourcesOf([{ label: "b" }, { label: "a" }, { label: "b" }, { label: null }]), ["a", "b"]);
  });
});

describe("deals feed section parity", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
  it("FeedPanel sections, Panel listId and index feedSections agree", () => {
    const feed = read("../news/FeedPanel.tsx");
    const literal = [...feed.matchAll(/<Section\s+id="([^"]+)"/g)].map((x) => x[1]).sort();
    const declared = feedSections("x", "y").map((s) => s.id).filter((i) => i !== "x").sort();
    assert.deepEqual(literal, declared, "news/FeedPanel.tsx literal <Section id> vs feedSections() ids");
    assert.ok(/<Section\s+id=\{listId\}/.test(feed), "news/FeedPanel.tsx must render <Section id={listId}>");
    const panelId = read("./Panel.tsx").match(/listId\s*=\s*"([^"]+)"/)?.[1];
    const indexId = read("./index.ts").match(/feedSections\(\s*"([^"]+)"/)?.[1];
    assert.equal(panelId, "deals", "deals/Panel.tsx listId");
    assert.equal(indexId, "deals", "deals/index.ts feedSections first argument");
    assert.equal(panelId, indexId, "deals: Panel.tsx listId vs index.ts feedSections id");
  });
});

describe("percentOff", () => {
  it("reads N% off", () => {
    assert.equal(percentOff("SSD 25% off today"), "-25%");
    assert.equal(percentOff("Save 100% off"), null);
    assert.equal(percentOff("no discount"), null);
  });
});
