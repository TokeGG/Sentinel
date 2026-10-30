import { test } from "node:test";
import assert from "node:assert/strict";
import { frontPage, imageSrc, masthead, sectionOf, trending, SECTIONS } from "./front.ts";
import { NEWS_CATALOG } from "./catalog/index.ts";

const now = Date.parse("2026-10-30T12:00:00Z");
const row = (id: number, title: string, src: string, hoursAgo = 1, extra: Record<string, unknown> = {}) =>
  ({ id, title, label: src, source_url: `https://${src}/rss`, published_at: new Date(now - hoursAgo * 3.6e6).toISOString(), ...extra });

test("trending ranks stories covered by more sources first", () => {
  const rows = [
    row(1, "Local bakery wins prize", "a.com", 0),
    row(2, "Senate passes major budget bill tonight", "b.com", 2),
    row(3, "Senate passes major budget bill tonight vote", "c.com", 2),
    row(4, "Senate passes major budget bill tonight", "d.com", 3),
  ];
  const s = trending(rows, now);
  assert.equal(s[0].lead.id, 2);
  assert.equal(s[0].sources, 3);
  assert.equal(s[1].lead.id, 1);
});

test("recency and taste break ties", () => {
  const s = trending([row(1, "Alpha story one", "a.com", 30), row(2, "Beta story two", "b.com", 1)], now);
  assert.equal(s[0].lead.id, 2);
  const t = trending([row(1, "Alpha story one", "a.com", 1), row(2, "Beta story two", "b.com", 1)], now, (r) => (r.id === 1 ? 1 : -1));
  assert.equal(t[0].lead.id, 1);
});

test("frontPage prefers an image lead among the top 3", () => {
  const st = trending([row(1, "Volcano erupts Iceland", "a.com", 0), row(2, "Markets rally Tokyo", "b.com", 1, { image: "https://i/x.jpg" })], now);
  const f = frontPage(st);
  assert.equal(f.lead?.lead.id, 2);
  assert.equal(f.rest.length, 1);
  assert.deepEqual(frontPage([]), { lead: null, rest: [] });
});

test("sectionOf uses catalog category, tag, and splits US out of world", () => {
  const tech = NEWS_CATALOG.find((c) => c.category === "tech")!;
  assert.equal(sectionOf({ source_url: tech.url }), "tech");
  assert.equal(sectionOf({ source_url: "https://x/feed", tag: "games" }), "gaming");
  assert.equal(sectionOf({ source_url: "https://x/feed" }), "");
  const world = NEWS_CATALOG.filter((c) => c.category === "world");
  assert.ok(world.map((w) => sectionOf({ source_url: w.url, label: w.label })).every((s) => s === "world" || s === "us"));
});

test("masthead + sections + imageSrc", () => {
  assert.equal(masthead(new Date(2026, 9, 30, 8)).edition, "Morning edition");
  assert.equal(masthead(new Date(2026, 9, 30, 20)).edition, "Evening edition");
  for (const id of ["front", "world", "us", "politics", "business", "tech", "science", "sports", "gaming", "congress", "foryou", "later", "sources"])
    assert.ok(SECTIONS.some((s) => s.id === id), id);
  assert.equal(imageSrc("http://x/y.jpg"), null);
  assert.equal(imageSrc("https://x/y.jpg"), "https://x/y.jpg");
});
