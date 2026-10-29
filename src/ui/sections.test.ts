import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { noneVisible, orderedVisible } from "./sections.ts";
import { defaultView, reorderSections, setSectionVisible } from "./prefs.ts";

const C = { sections: [{ id: "a", label: "A" }, { id: "b", label: "B", default: false }, { id: "c", label: "C" }] };

describe("orderedVisible", () => {
  it("lists visible section ids in view order", () =>
    assert.deepEqual(orderedVisible(defaultView(C)), ["a", "c"]));
  it("follows a reorder", () =>
    assert.deepEqual(orderedVisible(reorderSections(defaultView(C), 2, 0)), ["c", "a"]));
  it("drops hidden and shows re-enabled sections", () => {
    const v = setSectionVisible(setSectionVisible(defaultView(C), "a", false), "b", true);
    assert.deepEqual(orderedVisible(v), ["b", "c"]);
  });
  it("is empty for a module with no sections", () => assert.deepEqual(orderedVisible(defaultView()), []));
  it("is empty for a null view", () => assert.deepEqual(orderedVisible(null), []));
});

describe("noneVisible", () => {
  it("is false by default and with one visible", () => {
    assert.equal(noneVisible(defaultView(C)), false);
    assert.equal(noneVisible(setSectionVisible(setSectionVisible(defaultView(C), "a", false), "c", false)), true);
    assert.equal(noneVisible(setSectionVisible(setSectionVisible(defaultView(C), "a", false), "b", true)), false);
  });
  it("is false without sections or a view", () => {
    assert.equal(noneVisible(defaultView()), false);
    assert.equal(noneVisible(null), false);
  });
});
