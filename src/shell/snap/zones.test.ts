import { test } from "node:test";
import assert from "node:assert/strict";
import { assistFill, edgeZone, layoutRects, resizeGroup, sanitizeSnap, SNAP_LAYOUTS, zoneRect } from "./zones.ts";

const s = { x: 0, y: 32, w: 1000, h: 600 };
test("edge zones: edges, corners, none", () => {
  assert.equal(edgeZone({ x: 2, y: 300 }, s), "left");
  assert.equal(edgeZone({ x: 998, y: 300 }, s), "right");
  assert.equal(edgeZone({ x: 500, y: 34 }, s), "top");
  assert.equal(edgeZone({ x: 2, y: 40 }, s), "tl");
  assert.equal(edgeZone({ x: 990, y: 630 }, s), "br");
  assert.equal(edgeZone({ x: 500, y: 300 }, s), null);
});
test("zone rects honour the gap", () => {
  assert.deepEqual(zoneRect("left", s, 0), { x: 0, y: 32, w: 500, h: 600 });
  assert.deepEqual(zoneRect("top", s, 0), s);
  const l = zoneRect("left", s, 8), r = zoneRect("right", s, 8);
  assert.equal(r.x - (l.x + l.w), 8);
  assert.equal(l.x, 8);
  assert.deepEqual(zoneRect("br", s, 0), { x: 500, y: 332, w: 500, h: 300 });
});
test("every layout tiles the screen without overlap", () => {
  for (const l of SNAP_LAYOUTS) {
    const rs = layoutRects(l, s, 0);
    assert.equal(rs.reduce((a, r) => a + r.w * r.h, 0), s.w * s.h, l.id);
  }
});
test("snap assist fills the other zones in order", () => {
  assert.deepEqual(assistFill(3, 1, ["a", "b", "c"]), [{ zone: 0, id: "a" }, { zone: 2, id: "b" }]);
  assert.deepEqual(assistFill(2, 0, []), []);
});
test("shared divider: right neighbour follows a widened left panel", () => {
  const L = { x: 8, y: 40, w: 488, h: 584 }, R = { x: 504, y: 40, w: 488, h: 584 };
  const out = resizeGroup([{ id: "l", rect: L }, { id: "r", rect: R }, { id: "far", rect: { x: 0, y: 900, w: 10, h: 10 } }], "l", L, { ...L, w: 588 });
  assert.deepEqual(out, [{ id: "r", rect: { x: 604, y: 40, w: 388, h: 584 } }]);
});
test("sanitizeSnap", () => {
  assert.deepEqual(sanitizeSnap(null), { on: true, gap: 8 });
  assert.deepEqual(sanitizeSnap({ on: false, gap: 99 }), { on: false, gap: 32 });
});
test("Ctrl+Alt+Z opens Snap Layouts", async () => {
  const { keyToCmd } = await import("../desk/keymap.ts");
  assert.deepEqual(keyToCmd({ key: "z", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false }), { type: "snapLayouts" });
});
