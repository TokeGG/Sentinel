import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultView, mergeView, cssVars, reorderSections, setSectionVisible, exportView, importView,
} from "./prefs.ts";
import type { CustomizeDef } from "../core/customizeChecks.ts";

const C: CustomizeDef = {
  sections: [
    { id: "a", label: "A" },
    { id: "b", label: "B", default: false },
    { id: "c", label: "C", default: true },
  ],
  options: [
    { key: "dense", label: "Dense", type: "toggle", default: true },
    { key: "mode", label: "Mode", type: "select", default: "x", choices: ["x", "y"] },
    { key: "count", label: "Count", type: "number", default: 5, min: 1, max: 10 },
  ],
};
const ids = (v: { sections: { id: string }[] }) => v.sections.map((s) => s.id);

describe("prefs", () => {
  it("default view lists declared sections visible by default", () => {
    const v = defaultView(C);
    assert.deepEqual(v.sections, [
      { id: "a", visible: true }, { id: "b", visible: false }, { id: "c", visible: true },
    ]);
    assert.deepEqual(v.options, { dense: true, mode: "x", count: 5 });
    assert.equal(v.name, "Default");
    assert.equal(v.accent, "#396cd8");
    assert.equal(v.density, "roomy");
    assert.equal(v.fontScale, 1);
    assert.equal(v.tint, 0.5);
    assert.equal(v.refreshMinutes, null);
  });

  it("base overrides appearance fields only", () => {
    const v = defaultView(C, "Mine", {
      accent: "#112233", density: "compact", fontScale: 1.2, tint: 0.1, refreshMinutes: 5,
      sections: [{ id: "zzz", visible: true }], options: { evil: true },
    });
    assert.equal(v.name, "Mine");
    assert.equal(v.accent, "#112233");
    assert.equal(v.density, "compact");
    assert.equal(v.fontScale, 1.2);
    assert.equal(v.tint, 0.1);
    assert.equal(v.refreshMinutes, 5);
    assert.deepEqual(ids(v), ["a", "b", "c"]);
    assert.deepEqual(Object.keys(v.options), ["dense", "mode", "count"]);
  });

  it("merge drops unknown sections and keeps user order", () => {
    const v = mergeView({ sections: [{ id: "c", visible: false }, { id: "gone", visible: true }, { id: "a", visible: true }] }, C);
    assert.deepEqual(v.sections.slice(0, 2), [{ id: "c", visible: false }, { id: "a", visible: true }]);
    assert.ok(!ids(v).includes("gone"));
  });

  it("merge appends a newly added section with its default visibility", () => {
    const v = mergeView({ sections: [{ id: "a", visible: true }] }, C);
    assert.deepEqual(v.sections, [
      { id: "a", visible: true }, { id: "b", visible: false }, { id: "c", visible: true },
    ]);
  });

  it("merge rejects bad accent (url(), script, short hex) and falls back to default", () => {
    for (const accent of ["url(http://evil)", "<script>", "#fff", "#12345g", "red; x:y", 5, "#1234567"]) {
      assert.equal(mergeView({ accent }, C).accent, "#396cd8", String(accent));
    }
    assert.equal(mergeView({ accent: "#AbCdEf" }, C).accent, "#AbCdEf");
  });

  it("merge clamps fontScale tint refreshMinutes", () => {
    const hi = mergeView({ fontScale: 99, tint: 5, refreshMinutes: 99999 }, C);
    assert.equal(hi.fontScale, 1.4);
    assert.equal(hi.tint, 1);
    assert.equal(hi.refreshMinutes, 1440);
    const lo = mergeView({ fontScale: -3, tint: -1, refreshMinutes: 7 }, C);
    assert.equal(lo.fontScale, 0.8);
    assert.equal(lo.tint, 0);
    assert.equal(lo.refreshMinutes, 7);
    assert.equal(mergeView({ fontScale: "big", tint: NaN }, C).fontScale, 1);
  });

  it("mergeView with refreshMinutes 0 or 1.5 or \"5\" falls back to null", () => {
    for (const r of [0, 1.5, "5"]) assert.equal(mergeView({ refreshMinutes: r }, C).refreshMinutes, null);
  });

  it("merge coerces option types and drops unknown options", () => {
    const v = mergeView({ options: { dense: "yes", mode: "zzz", count: 999, extra: 1 } }, C);
    assert.deepEqual(v.options, { dense: true, mode: "x", count: 10 });
    const w = mergeView({ options: { dense: false, mode: "y", count: 0 } }, C);
    assert.deepEqual(w.options, { dense: false, mode: "y", count: 1 });
    assert.equal(mergeView({ options: { count: "7" } }, C).options.count, 5);
  });

  it("mergeView ignores prototype-pollution keys (__proto__, constructor) in options", () => {
    const raw = JSON.parse('{"options":{"__proto__":{"x":1},"constructor":"y","dense":false}}');
    const v = mergeView(raw, C);
    assert.deepEqual(Object.keys(v.options), ["dense", "mode", "count"]);
    assert.equal(v.options.dense, false);
    assert.equal(({} as Record<string, unknown>).x, undefined);
  });

  it("mergeView with duplicate section ids in raw keeps first", () => {
    const v = mergeView({ sections: [{ id: "a", visible: false }, { id: "a", visible: true }] }, C);
    assert.equal(v.sections.filter((s) => s.id === "a").length, 1);
    assert.equal(v.sections[0].visible, false);
  });

  it("merge of null or a string returns the default view", () => {
    assert.deepEqual(mergeView(null, C), defaultView(C));
    assert.deepEqual(mergeView("junk", C), defaultView(C));
    assert.deepEqual(mergeView([1], C), defaultView(C));
  });

  it("cssVars outputs the four variables", () => {
    assert.deepEqual(cssVars(defaultView(C)), {
      "--accent": "#396cd8", "--density": "1", "--font-scale": "1", "--tint": "0.5",
    });
    assert.equal(cssVars({ ...defaultView(C), density: "compact" })["--density"], "0.75");
  });

  it("reorder moves a section and is a no-op for out-of-range indexes", () => {
    const v = defaultView(C);
    assert.deepEqual(ids(reorderSections(v, 0, 2)), ["b", "c", "a"]);
    for (const [f, t] of [[-1, 0], [0, 3], [3, 0], [0, -1], [1.5, 0]]) {
      assert.deepEqual(ids(reorderSections(v, f, t)), ["a", "b", "c"]);
    }
  });

  it("setSectionVisible toggles only that section", () => {
    const v = setSectionVisible(defaultView(C), "a", false);
    assert.deepEqual(v.sections.map((s) => s.visible), [false, false, true]);
  });

  it("import then export round-trips", () => {
    const v = mergeView({ name: "Mine", accent: "#010203", density: "compact", fontScale: 1.1, tint: 0.2, refreshMinutes: 30 }, C);
    assert.deepEqual(importView(exportView(v), C), v);
  });

  it("exportView output re-imports to an equal view", () => {
    const v = setSectionVisible(reorderSections(defaultView(C, "Z"), 2, 0), "b", true);
    assert.deepEqual(importView(exportView(v), C), v);
  });

  it("import of garbage throws invalid view", () => {
    assert.throws(() => importView("not json", C), /invalid view/);
    assert.throws(() => importView("null", C), /invalid view/);
  });

  it("importView rejects a JSON array and a JSON number", () => {
    assert.throws(() => importView("[1,2]", C), /invalid view/);
    assert.throws(() => importView("42", C), /invalid view/);
  });

  it("zero-section manifest yields empty sections", () => {
    assert.deepEqual(defaultView().sections, []);
    assert.deepEqual(mergeView({ sections: [{ id: "a", visible: true }] }, {}).sections, []);
    assert.deepEqual(defaultView().options, {});
  });
});
