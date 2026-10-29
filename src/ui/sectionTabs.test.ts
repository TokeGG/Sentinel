import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTab, visibleTabs } from "./sectionTabs.ts";

const tabs = [{ id: "a", label: "A", sections: ["a1", "a2"] }, { id: "b", label: "B", sections: ["b1"] }];
test("no view shows all tabs", () => assert.equal(visibleTabs(tabs, null).length, 2));
test("tab hidden when all its sections are hidden", () => {
  assert.deepEqual(visibleTabs(tabs, ["a2"]).map((t) => t.id), ["a"]);
  assert.deepEqual(visibleTabs(tabs, ["b1", "a1"]).map((t) => t.id), ["a", "b"]);
});
test("never returns an empty bar", () => assert.equal(visibleTabs(tabs, []).length, 1));
test("pickTab falls back to first", () => {
  assert.equal(pickTab(tabs, "b"), "b");
  assert.equal(pickTab(tabs, "zzz"), "a");
});
