import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { drop, emptyNav, popClosed, pushClosed, step, visit } from "./nav.ts";
import { nextMonitor, snapRect, tileRects } from "./snap.ts";
import { cleanName, sanitizeLayouts, switchPlan } from "./namedLayouts.ts";
import { keyToCmd } from "./keymap.ts";

const all = () => true;
describe("nav", () => {
  it("visits, goes back and forward", () => {
    let s = visit(visit(visit(emptyNav(), "a"), "b"), "c");
    s = step(s, "back", all)!;
    assert.equal(s.cur, "b");
    s = step(s, "back", all)!;
    assert.equal(s.cur, "a");
    assert.equal(step(s, "back", all), null);
    s = step(s, "fwd", all)!;
    assert.equal(s.cur, "b");
    assert.deepEqual(visit(s, "d").fwd, []);
  });
  it("skips closed panels and drops", () => {
    const s = visit(visit(visit(emptyNav(), "a"), "b"), "c");
    assert.equal(step(s, "back", (id) => id !== "b")!.cur, "a");
    assert.deepEqual(drop(s, "c").cur, null);
  });
  it("closed stack reopens most recent not-open", () => {
    const st = pushClosed(pushClosed(pushClosed([], { id: "a" }), { id: "b" }), { id: "a" });
    assert.deepEqual(st.map((c) => c.id), ["b", "a"]);
    const r = popClosed(st, (id) => id === "a");
    assert.equal(r.item?.id, "b");
    assert.deepEqual(r.next, []);
  });
});

const screen = { x: 0, y: 32, w: 1000, h: 600 };
describe("snap + tile", () => {
  it("snaps to screen and panel edges", () => {
    assert.deepEqual(snapRect({ x: 10, y: 40, w: 200, h: 100 }, screen, []), { x: 0, y: 32, w: 200, h: 100 });
    assert.deepEqual(snapRect({ x: 305, y: 300, w: 200, h: 100 }, screen, [{ x: 100, y: 32, w: 200, h: 200 }]).x, 300);
    assert.deepEqual(snapRect({ x: 500, y: 300, w: 200, h: 100 }, screen, []), { x: 500, y: 300, w: 200, h: 100 });
  });
  it("tile presets cover the screen", () => {
    const cols = tileRects("columns", 3, screen);
    assert.equal(cols.reduce((a, r) => a + r.w, 0), 1000);
    const main = tileRects("main", 3, screen);
    assert.deepEqual(main[0], { x: 0, y: 32, w: 600, h: 600 });
    assert.equal(main[1].h + main[2].h, 600);
    assert.equal(tileRects("rows", 2, screen)[1].y, 332);
    assert.equal(tileRects("grid", 4, screen).length, 4);
    assert.deepEqual(tileRects("grid", 0, screen), []);
  });
  it("next monitor wraps", () => {
    const m = (x: number) => ({ name: null, position: { x, y: 0 }, size: { width: 100, height: 100 } });
    assert.equal(nextMonitor([m(0), m(100)], { x: 150, y: 5 }), 0);
    assert.equal(nextMonitor([m(0), m(100)], { x: 5, y: 5 }), 1);
    assert.equal(nextMonitor([], { x: 0, y: 0 }), -1);
  });
});

describe("named layouts", () => {
  it("sanitizes and plans a switch", () => {
    const l = sanitizeLayouts({ work: [{ id: "hub.notes", rect: { x: 0, y: 0, w: 1, h: 1 } }, { id: 3 }], "../bad": [], gaming: "x" });
    assert.deepEqual(Object.keys(l), ["work"]);
    assert.equal(l.work.length, 1);
    assert.equal(cleanName("  stream "), "stream");
    assert.equal(cleanName(""), null);
    const p = switchPlan(["hub.notes", "hub.news"], [...l.work, { id: "gone", rect: { x: 0, y: 0, w: 1, h: 1 } }], (id) => id !== "gone");
    assert.deepEqual(p.close, ["hub.news"]);
    assert.deepEqual(p.open.map((x) => x.id), ["hub.notes"]);
  });
});

describe("keymap", () => {
  const k = (key: string, o: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) =>
    keyToCmd({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o });
  it("maps shortcuts", () => {
    assert.deepEqual(k("k", { ctrlKey: true }), { type: "palette" });
    assert.deepEqual(k("T", { ctrlKey: true, shiftKey: true }), { type: "reopen" });
    assert.deepEqual(k("ArrowLeft", { altKey: true }), { type: "back" });
    assert.equal(k("k"), null);
  });
});
