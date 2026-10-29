import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notesSections, splitFiled } from "./panelLogic.ts";

describe("splitFiled", () => {
  it("separates unfiled (null/empty/blank) from filed", () => {
    const rows = [
      { id: 1, filed_to: null },
      { id: 2, filed_to: "Work" },
      { id: 3, filed_to: "" },
      { id: 4 },
      { id: 5, filed_to: "  " },
    ];
    const { unfiled, filed } = splitFiled(rows);
    assert.deepEqual(unfiled.map((r) => r.id), [1, 3, 4, 5]);
    assert.deepEqual(filed.map((r) => r.id), [2]);
  });
  it("handles an empty list", () => {
    assert.deepEqual(splitFiled([]), { unfiled: [], filed: [] });
  });
});

describe("notes sections parity", () => {
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, notesSections.map((s) => s.id).sort());
  });
  it("Filed notes stays hidden by default", () => {
    assert.equal(notesSections.find((s) => s.id === "filed")?.default, false);
  });
});
