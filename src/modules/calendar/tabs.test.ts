import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calendarSections } from "./panelLogic.ts";
import { CAL_TABS } from "./tabs.ts";

test("every <Section id> in Panel.tsx is declared, and vice versa", () => {
  const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
  const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(used, calendarSections.map((s) => s.id).sort());
});
test("every section sits in exactly one tab", () => {
  assert.deepEqual(CAL_TABS.flatMap((t) => t.sections).sort(), calendarSections.map((s) => s.id).sort());
});
