import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { squarify } from "./treemap.ts";

describe("squarify", () => {
  it("fills the box with areas proportional to size", () => {
    const r = squarify([6, 6, 4, 3, 2, 2, 1].map((size, i) => ({ name: String(i), size })), { x: 0, y: 0, w: 6, h: 4 });
    assert.equal(r.length, 7);
    const area = r.reduce((a, b) => a + b.w * b.h, 0);
    assert.ok(Math.abs(area - 24) < 1e-9);
    r.forEach((p) => assert.ok(Math.abs(p.w * p.h - p.size) < 1e-9));
    r.forEach((p) => assert.ok(p.x >= -1e-9 && p.y >= -1e-9 && p.x + p.w <= 6 + 1e-9 && p.y + p.h <= 4 + 1e-9));
  });
  it("drops empty/invalid sizes and handles empty input", () => {
    assert.deepEqual(squarify([], { x: 0, y: 0, w: 1, h: 1 }), []);
    assert.equal(squarify([{ name: "a", size: 0 }, { name: "b", size: NaN }, { name: "c", size: 5 }], { x: 0, y: 0, w: 2, h: 2 }).length, 1);
  });
});
