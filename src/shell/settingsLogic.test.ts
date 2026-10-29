import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAppearance, sanitizeAppearance, scheduleRows } from "./settingsLogic.ts";
import { defaultView } from "../ui/prefs.ts";
import type { ModuleManifest } from "../core/module.ts";

const mod = (id: string, name: string, every?: number) =>
  ({ id, name, schedule: every ? { skill: "s", intervalMinutes: every } : undefined }) as unknown as ModuleManifest;

describe("scheduleRows", () => {
  it("lists only modules with a schedule, sorted by name", () => {
    const rows = scheduleRows([mod("hub.z", "Weather", 30), mod("hub.n", "Notes"), mod("hub.a", "News", 15)], {});
    assert.deepEqual(rows.map((r) => r.name), ["News", "Weather"]);
    assert.equal(rows[0].everyMinutes, 15);
  });
  it("uses the enabled map and defaults to off", () => {
    const rows = scheduleRows([mod("hub.a", "A", 5), mod("hub.b", "B", 5)], { "hub.b": true });
    assert.deepEqual(rows.map((r) => r.enabled), [false, true]);
  });
});

describe("sanitizeAppearance", () => {
  it("rejects a bad accent and clamps font scale", () => {
    const a = sanitizeAppearance({ accent: "red; x:y", density: "compact", fontScale: 9 });
    assert.equal(a.accent, "#396cd8");
    assert.equal(a.density, "compact");
    assert.equal(a.fontScale, 1.4);
    assert.equal(sanitizeAppearance({ fontScale: 0.1 }).fontScale, 0.8);
    assert.equal(sanitizeAppearance({ density: "huge" }).density, "roomy");
  });
  it("of garbage returns the defaults", () => {
    const d = { accent: "#396cd8", density: "roomy", fontScale: 1 };
    for (const g of [null, undefined, 5, "x", [], { accent: 3, fontScale: "a" }]) assert.deepEqual(sanitizeAppearance(g), d);
  });
});

describe("applyAppearance", () => {
  const base = {
    ...defaultView({ sections: [{ id: "a", label: "A" }], options: [{ key: "k", label: "K", type: "toggle", default: true }] }, "Mine"),
    accent: "#112233", refreshMinutes: 7,
  };
  const a = { accent: "#abcdef", density: "compact" as const, fontScale: 1.2 };
  it("keeps the module's accent unless useAccent", () => {
    const v = applyAppearance(base, a, false);
    assert.equal(v.accent, "#112233");
    assert.equal(v.density, "compact");
    assert.equal(v.fontScale, 1.2);
    assert.equal(applyAppearance(base, a, true).accent, "#abcdef");
  });
  it("never touches sections, options, name or refresh", () => {
    const v = applyAppearance(base, a, true);
    assert.deepEqual([v.sections, v.options, v.name, v.refreshMinutes, v.tint], [base.sections, base.options, "Mine", 7, base.tint]);
  });
  it("sanitizes the appearance it applies", () => {
    const v = applyAppearance(base, { accent: "javascript:1", density: "x" as never, fontScale: 99 }, true);
    assert.deepEqual([v.accent, v.density, v.fontScale], ["#396cd8", "roomy", 1.4]);
  });
});
