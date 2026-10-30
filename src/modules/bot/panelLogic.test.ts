import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Observation } from "./actions.ts";
import { botSections, confirmText, fxOn, episodeLabel, modelStatus, mistakeLines, noteUrlOk, OUTCOME_LABEL, START_URL } from "./panelLogic.ts";

const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");

describe("bot panelLogic", () => {
  it("manifest sections match the <Section id> values in Panel.tsx", () => {
    const used = [...read("./Panel.tsx").matchAll(/<Section id="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(used.sort(), botSections.map((s) => s.id).sort());
    assert.deepEqual(botSections.map((s) => s.id), ["run", "log", "knowledge", "brain", "workflows", "jobs", "sites", "weekly", "coach", "models", "routines", "settings", "rules", "stats", "memory"]);
  });
  it("the module manifest uses the same sections and is a custom panel with static ring/icon/accent", () => {
    const src = read("./index.ts");
    assert.match(src, /id: "hub\.bot"/);
    assert.match(src, /panel: "custom"/);
    assert.match(src, /customize: \{ sections: botSections(, options: botLimits)? \}/);
    assert.match(src, /^\s*icon: "bot",/m);
    assert.match(src, /^\s*ring: "[a-z]+",/m);
    assert.match(src, /^\s*accent: "#[0-9a-fA-F]{6}",/m);
    const code = src.replace(/\/\/.*$/gm, "");
    assert.ok(!/setInterval|autostart/i.test(code), "no own timers, no autostart");
    assert.match(code, /schedule: \{ skill: "run_due_jobs", intervalMinutes: \d+ \}/, "jobs only via the opt-in scheduler");
  });
  it("model status: no model, Ollama down, model missing, ready", () => {
    const tags = { models: [{ name: "llama3:8b", size: 1 }] };
    assert.match(modelStatus(null, tags).text, /Skills & MCP/);
    assert.match(modelStatus("", tags).text, /No local model/);
    const down = modelStatus("llama3:8b", null);
    assert.equal(down.ok, false);
    assert.match(down.text, /Ollama is not running/);
    assert.match(modelStatus("other", tags).text, /not installed/);
    assert.deepEqual(modelStatus("llama3:8b", tags).ok, true);
    assert.equal(modelStatus("llama3:8b", { nope: 1 }).ok, false);
  });
  it("confirm text names the page, the action and the element", () => {
    const o: Observation = { url: "https://shop.test/cart", title: "Cart", text: "", hash: "h", elements: [{ id: "4", role: "button", text: "Pay now", visible: true }] };
    assert.deepEqual(confirmText({ type: "purchase", target: "4" }, o), { page: "Cart - https://shop.test/cart", action: "purchase", element: "button: Pay now" });
    assert.equal(confirmText({ type: "delete", target: "9" }, o).element, "[9]");
  });
  it("labels, mistakes, urls", () => {
    assert.deepEqual(mistakeLines({ loop: 2, timeout: 0 }), ["2 x repeated identical actions (stuck loop)"]);
    assert.equal(episodeLabel({ id: 1, goal: "find x", outcome: "done", steps: 3, thumbs: null, created_at: "" }), "find x - finished, 3 steps");
    assert.equal(episodeLabel({ id: 1, goal: "g", outcome: "weird", steps: 0, thumbs: null, created_at: "" }), "g - weird, 0 steps");
    assert.equal(Object.keys(OUTCOME_LABEL).length, 8);
    assert.ok(noteUrlOk("https://a.test/x") && noteUrlOk(" http://a.test ") && !noteUrlOk("file:///x") && !noteUrlOk("javascript:1") && !noteUrlOk("nope"));
    assert.ok(noteUrlOk(START_URL));
  });
});

describe("fxOn", () => {
  it("animates unless reduced motion is on and not overridden", () => {
    assert.equal(fxOn(false, false), true);
    assert.equal(fxOn(true, true), true);
    assert.equal(fxOn(true, false), false);
  });
});
