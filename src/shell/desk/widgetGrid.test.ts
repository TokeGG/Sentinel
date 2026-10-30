import test from "node:test";
import assert from "node:assert/strict";
import { addWidget, cellAt, defaultWidgets, moveWidget, parseWidgets, removeWidget, resizeWidget, sanitizeWidgets } from "./widgetGrid.ts";

const noOverlap = (l: { x: number; y: number; w: number; h: number }[]) => l.every((a, i) => l.every((b, j) => i === j || !(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)));

test("add fills free spots without overlap", () => {
  let l = addWidget([], "a"); l = addWidget(l, "b"); l = addWidget(l, "c"); l = addWidget(l, "d");
  assert.deepEqual(l.find((g) => g.id === "b"), { id: "b", x: 4, y: 0, w: 4, h: 4 });
  assert.equal(l.find((g) => g.id === "d")!.y, 4);
  assert.ok(noOverlap(l));
  assert.equal(addWidget(l, "a").length, 4);
});

test("move and resize push others down, clamp to grid", () => {
  let l = defaultWidgets(["a", "b"]);
  l = moveWidget(l, "b", 0, 0);
  assert.deepEqual([l.find((g) => g.id === "b")!.x, l.find((g) => g.id === "b")!.y], [0, 0]);
  assert.ok(noOverlap(l));
  l = resizeWidget(l, "b", 99, 0);
  assert.deepEqual([l.find((g) => g.id === "b")!.w, l.find((g) => g.id === "b")!.h], [12, 1]);
  assert.ok(noOverlap(l));
  assert.equal(removeWidget(l, "a").length, 1);
});

test("sanitize and cellAt", () => {
  assert.deepEqual(sanitizeWidgets([{ id: "a", x: 20, y: -3, w: 1, h: 2 }, { id: "a", x: 0, y: 0, w: 4, h: 4 }, { id: 5 }]), [{ id: "a", x: 10, y: 0, w: 2, h: 2 }]);
  assert.equal(parseWidgets(null), null);
  assert.deepEqual(cellAt(150, 130, { left: 0, top: 10, width: 1200 }, 60), { x: 1, y: 2 });
});
