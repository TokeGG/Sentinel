import test from "node:test";
import assert from "node:assert/strict";
import { moonCount, moonPositions, moonPositionsInto, badgeText, unreadText, MOON_MAX } from "./moons.ts";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("moonCount caps at 5", () => {
  assert.equal(MOON_MAX, 5);
  assert.deepEqual([0, 1, 5, 6, 999].map(moonCount), [0, 1, 5, 5, 5]);
  assert.deepEqual([-3, NaN, 2.7].map(moonCount), [0, 0, 2]);
});

test("moonPositions are deterministic per id and on the radius", () => {
  const a = moonPositions(4, 50, 3.2, "hub.notes"), b = moonPositions(4, 50, 3.2, "hub.notes");
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  for (const p of a) close(Math.hypot(p.x, p.y), 50, 1e-6);
  assert.notDeepEqual(a, moonPositions(4, 50, 3.2, "hub.other")); // phase differs per id
  assert.notDeepEqual(a, moonPositions(4, 50, 4.2, "hub.notes")); // and moves with time
});

test("moonPositions of 0 is empty", () => assert.deepEqual(moonPositions(0, 50, 1, "a"), []));

test("moonPositions never allocates more than count entries and handles radius 0/NaN", () => {
  assert.equal(moonPositions(100, 10, 0, "a").length, 5);
  assert.equal(moonPositions(2, 10, 0, "a").length, 2);
  for (const r of [0, NaN, -5, Infinity]) {
    for (const p of moonPositions(3, r, NaN, "a")) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      if (r === 0 || Number.isNaN(r) || r < 0) assert.deepEqual(p, { x: 0, y: 0 });
    }
  }
  const out = [{ x: 9, y: 9 }];
  assert.equal(moonPositionsInto(out, 3, 10, 0, "a"), 1); // writes at most out.length
});

test("badgeText formats 0, 7, 99, 100", () => {
  assert.deepEqual([0, 7, 99, 100, 999].map(badgeText), ["", "7", "99", "99+", "99+"]);
  assert.equal(badgeText(NaN), "");
});

test("badge text cache returns the same string for the same count", () => {
  assert.equal(unreadText(3), "3 unread");
  assert.equal(unreadText(3), unreadText(3));
  assert.equal(unreadText(0), "");
  assert.equal(unreadText(1000), "999 unread");
});
