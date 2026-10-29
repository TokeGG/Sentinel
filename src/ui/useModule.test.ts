import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { errorText, findSkill, intervalMs } from "./moduleRun.ts";
import type { ModuleManifest } from "../core/module.ts";

const m = {
  id: "t.mod",
  name: "T",
  description: "t",
  panel: "list",
  skills: [{ name: "go", run: async () => 1 }],
} as ModuleManifest;

describe("findSkill", () => {
  it("returns the named skill", () => assert.equal(findSkill(m, "go").name, "go"));
  it('throws unknown skill "x" for a missing skill', () =>
    assert.throws(() => findSkill(m, "x"), { message: 'unknown skill "x"' }));
});

describe("errorText", () => {
  it("flattens an Error to its message", () => assert.equal(errorText(new Error("boom")), "boom"));
  it("passes a string through", () => assert.equal(errorText("nope"), "nope"));
  it("never returns empty for undefined", () => assert.equal(errorText(undefined), "unknown error"));
  it("stringifies other values", () => assert.equal(errorText(42), "42"));
});

describe("intervalMs", () => {
  it("is null for null", () => assert.equal(intervalMs(null), null));
  it("is minutes * 60000 otherwise", () => assert.equal(intervalMs(5), 300_000));
  it("is null for 0", () => assert.equal(intervalMs(0), null));
  it("is null for negatives and NaN", () => {
    assert.equal(intervalMs(-1), null);
    assert.equal(intervalMs(NaN), null);
  });
});
