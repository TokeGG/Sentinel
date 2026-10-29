import test from "node:test";
import assert from "node:assert/strict";
import { mergeBadge, totalBadges, refreshBadges, parsePlanetBadge, withTimeout, PLANET_BADGE, BADGE_TIMEOUT_MS } from "./badges.ts";
import { applyRefresh, getBadges, getPulseStart, resetBadges, setBadge } from "./badgeStore.ts";
import type { ModuleManifest } from "../core/module.ts";

const mod = (id: string, badge?: () => Promise<number>) => ({ id, badge }) as unknown as ModuleManifest;

test("event name", () => assert.equal(PLANET_BADGE, "planet-badge"));

test("mergeBadge sanitizes negative NaN and fractional counts", () => {
  for (const bad of [-1, NaN, 1.5, Infinity, "3" as unknown as number, undefined as unknown as number]) {
    assert.equal(mergeBadge({}, "a", bad).a, 0);
  }
  assert.equal(mergeBadge({}, "a", 7).a, 7);
});

test("mergeBadge does not mutate and keeps other ids", () => {
  const b = { x: 1 };
  const n = mergeBadge(b, "y", 2);
  assert.deepEqual(b, { x: 1 });
  assert.deepEqual(n, { x: 1, y: 2 });
});

test("mergeBadge caps at 999", () => assert.equal(mergeBadge({}, "a", 5000).a, 999));

test("mergeBadge ignores __proto__/constructor ids", () => {
  for (const id of ["__proto__", "constructor", "prototype", "toString", ""]) {
    const n = mergeBadge({}, id, 5);
    assert.deepEqual(Object.keys(n), []);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  }
});

test("totalBadges sums", () => {
  assert.equal(totalBadges({}), 0);
  assert.equal(totalBadges({ a: 3, b: 12 }), 15);
});

test("refreshBadges survives one failing badge()", async () => {
  const r = await refreshBadges([mod("a", async () => 3), mod("b", async () => { throw new Error("x"); }), mod("c", async () => 4)]);
  assert.deepEqual(r, { a: 3, b: 0, c: 4 });
});

test("refreshBadges survives a synchronous throw and junk values", async () => {
  const r = await refreshBadges([mod("a", () => { throw new Error("sync"); }), mod("b", async () => NaN)]);
  assert.deepEqual(r, { a: 0, b: 0 });
});

test("refreshBadges skips modules without badge", async () => {
  const r = await refreshBadges([mod("a"), mod("b", async () => 2)]);
  assert.deepEqual(r, { b: 2 });
});

test("refreshBadges times out a hanging badge()", async () => {
  const t0 = Date.now();
  const r = await refreshBadges([mod("hang", () => new Promise<number>(() => {})), mod("ok", async () => 1)], 40);
  assert.deepEqual(r, { hang: 0, ok: 1 });
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(BADGE_TIMEOUT_MS, 3000);
});

test("withTimeout resolves fast promises and falls back on rejection", async () => {
  assert.equal(await withTimeout(Promise.resolve(5), 1000, 0), 5);
  assert.equal(await withTimeout(Promise.reject(new Error("x")), 1000, 9), 9);
});

test("planet-badge payload validation rejects bad payloads", () => {
  const known = ["hub.discord", "hub.notes"];
  assert.deepEqual(parsePlanetBadge({ id: "hub.discord", count: 3 }, known), { id: "hub.discord", count: 3 });
  for (const bad of [null, undefined, 5, "x", [], {}, { id: "hub.discord" }, { id: "hub.discord", count: "3" },
    { id: 7, count: 1 }, { id: "unknown", count: 1 }, { id: "__proto__", count: 1 }, { id: "x".repeat(65), count: 1 }]) {
    assert.equal(parsePlanetBadge(bad, known), null);
  }
  assert.equal(parsePlanetBadge({ id: "x".repeat(65), count: 1 }, ["x".repeat(65)]), null);
});

test("store pulses only on increase, not on first load", () => {
  resetBadges();
  applyRefresh({ a: 3 }, 100);
  assert.equal(getPulseStart("a"), 0); // first load: no pulse
  setBadge("a", 4, 500);
  assert.equal(getPulseStart("a"), 500);
  setBadge("a", 2, 900);
  assert.equal(getPulseStart("a"), 500); // decrease keeps the old start
  assert.deepEqual(getBadges(), { a: 2 });
  applyRefresh({ b: 1 }, 1000); // web ids not in the refresh are kept
  setBadge("w", 2, 1100);
  applyRefresh({ b: 1 }, 1200);
  assert.equal(getBadges().w, 2);
  setBadge("w", 0);
  assert.equal(getBadges().w, 0);
});
