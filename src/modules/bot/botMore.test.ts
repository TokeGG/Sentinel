import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Episode, Observation } from "./actions.ts";
import { modelFor, ollamaOptions, parseBotSettings, suggestPresets, DEFAULT_SETTINGS } from "./botSettings.ts";
import { parseSiteRules, ruleFor, setRule, siteRuleVerdict } from "./siteRules.ts";
import { addUsage, costLine, emptyCost } from "./runCost.ts";
import { skillStats } from "./skillStats.ts";
import { importPreview, makeRecipe, parseRecipe, recipeText, workflowHosts } from "./recipe.ts";
import { addPrompt, continueAfter, parsePrompts, parseRoutines, removeById, upsertRoutine } from "./library.ts";
import { canEnable, previewLines } from "./jobPreview.ts";
import { clearSummary, dropLesson, editNote, lessonRows } from "./memory.ts";
import type { Workflow } from "./workflow.ts";

const ep = (o: Partial<Episode>): Episode => ({ goal: "g", steps: [], outcome: "done", maxSteps: 10, startedAt: 0, endedAt: 42_000, ...o });

describe("botSettings", () => {
  it("parses tolerantly and clamps", () => {
    assert.deepEqual(parseBotSettings("nope"), DEFAULT_SETTINGS);
    const s = parseBotSettings(JSON.stringify({ preset: "smart", presets: { smart: "big:70b", fast: 3 }, temperature: 9, numCtx: -5, stepDelayMs: 99999 }));
    assert.equal(s.preset, "smart"); assert.equal(s.presets.fast, ""); assert.equal(s.temperature, 2); assert.equal(s.numCtx, 0); assert.equal(s.stepDelayMs, 10000);
    assert.equal(parseBotSettings('{"preset":"huge"}').preset, "default");
  });
  it("model + options", () => {
    const s = { ...DEFAULT_SETTINGS, preset: "fast" as const, presets: { fast: "f", smart: "", tiny: "" } };
    assert.equal(modelFor(s, "x"), "f");
    assert.equal(modelFor({ ...s, preset: "tiny" }, "x"), "x");
    assert.deepEqual(ollamaOptions(DEFAULT_SETTINGS, 0.4), { temperature: 0.4 });
    assert.deepEqual(ollamaOptions({ ...DEFAULT_SETTINGS, temperature: 0.7, numCtx: 4096 }), { temperature: 0.7, num_ctx: 4096 });
    assert.deepEqual(suggestPresets([{ name: "b", size: 5 }, { name: "a", size: 1 }, { name: "c", size: 9 }]), { tiny: "a", fast: "b", smart: "c" });
  });
});

describe("siteRules", () => {
  const obs = (url: string, role = "button", text = "Buy now"): Observation => ({ url, title: "", text: "", hash: "h", elements: [{ id: "1", role, text, visible: true }, { id: "2", role: "link", text: "Reviews", visible: true }] });
  const rules = setRule(setRule({}, "https://www.Shop.test/x", "nobuy"), "news.test", "readonly");
  it("stores normalised hosts and drops junk", () => {
    assert.deepEqual(rules, { "shop.test": "nobuy", "news.test": "readonly" });
    assert.deepEqual(parseSiteRules('{"shop.test":"nobuy","bad host":"readonly","x.test":"weird"}'), { "shop.test": "nobuy" });
    assert.equal(ruleFor(rules, "https://cart.shop.test/"), "nobuy");
    assert.equal(ruleFor(rules, "https://other.test/"), "allowed");
  });
  it("nobuy blocks irreversible and buy-labelled clicks", () => {
    assert.equal(siteRuleVerdict(rules, { type: "click", target: "1" }, obs("https://shop.test/")).allowed, false);
    assert.equal(siteRuleVerdict(rules, { type: "submit", target: "2" }, obs("https://shop.test/")).allowed, false);
    assert.equal(siteRuleVerdict(rules, { type: "click", target: "2" }, obs("https://shop.test/")).allowed, true);
    assert.equal(siteRuleVerdict(rules, { type: "type", target: "2", text: "x" }, obs("https://shop.test/")).allowed, true);
  });
  it("readonly allows only reading", () => {
    const o = obs("https://news.test/a");
    assert.equal(siteRuleVerdict(rules, { type: "type", target: "1", text: "x" }, o).allowed, false);
    assert.equal(siteRuleVerdict(rules, { type: "press", key: "Enter" }, o).allowed, false);
    assert.equal(siteRuleVerdict(rules, { type: "click", target: "1" }, o).allowed, false);
    assert.equal(siteRuleVerdict(rules, { type: "click", target: "2" }, o).allowed, true);
    assert.equal(siteRuleVerdict(rules, { type: "scroll", dir: "down" }, o).allowed, true);
    assert.equal(siteRuleVerdict(rules, { type: "goto", url: "https://news.test/b" }, o).allowed, true);
    assert.equal(siteRuleVerdict(rules, { type: "click", target: "1" }, obs("https://free.test/")).allowed, true);
  });
});

describe("runCost + skillStats", () => {
  it("adds usage and formats", () => {
    let c = addUsage(emptyCost("m"), { prompt_eval_count: 1000, eval_count: 20 });
    c = addUsage(c, {});
    assert.deepEqual(c, { model: "m", calls: 2, promptTokens: 1000, outputTokens: 20, tokensKnown: true });
    assert.equal(costLine({ ...ep({}), cost: c }), "0 steps, 42 s, m, 2 model calls, 1,000 in + 20 out tokens");
    assert.match(costLine({ ...ep({}), cost: emptyCost("") }), /tokens not reported/);
  });
  it("stats: used, never, failing", () => {
    const st = skillStats([ep({ skills: ["a", "b"] }), ep({ skills: ["a"], outcome: "failed" }), ep({ skills: ["a"], outcome: "done", thumbs: "down" }), ep({ skills: ["b"], outcome: "dry" })], ["a", "b", "c"]);
    assert.deepEqual(st.used.map((s) => [s.name, s.uses, s.fails]), [["a", 3, 2], ["b", 1, 0]]);
    assert.deepEqual(st.never, ["c"]);
    assert.deepEqual(st.failing.map((s) => s.name), ["a"]);
  });
});

describe("recipes", () => {
  const wf: Workflow = { id: 3, name: "Hours", goal: "find hours", startUrl: "https://lib.test/", steps: [{ action: { type: "goto", url: "https://www.city.test/x" } }, { action: { type: "submit", target: "1" }, el: { role: "button", text: "Go" } }], source: "demo" };
  it("round-trips with only the visited sites' notes", () => {
    assert.deepEqual(workflowHosts(wf), ["lib.test", "city.test"]);
    const r = makeRecipe(wf, [{ host: "lib.test", text: "a" }, { host: "zzz.test", text: "b" }]);
    assert.equal(r.notes.length, 1);
    const p = parseRecipe(recipeText(r));
    assert.ok(p.ok && p.recipe.workflow.steps.length === 2 && !("id" in p.recipe.workflow));
    if (p.ok) {
      const lines = importPreview(p.recipe, ["Hours"], [{ host: "lib.test", text: "a" }]);
      assert.match(lines[0], /exists/); assert.match(lines[1], /nothing new/); assert.match(lines[2], /irreversible/);
    }
  });
  it("rejects bad input", () => {
    assert.equal(parseRecipe("x").ok, false);
    assert.equal(parseRecipe('{"kind":"other","version":1}').ok, false);
    assert.equal(parseRecipe(JSON.stringify({ kind: "sentinel-bot-recipe", version: 1, workflow: { startUrl: "file:///c", steps: [{ action: { type: "wait" } }] } })).ok, false);
    assert.equal(parseRecipe(JSON.stringify({ kind: "sentinel-bot-recipe", version: 1, workflow: { steps: [{ action: { type: "rm" } }] } })).ok, false);
  });
});

describe("library", () => {
  it("prompts", () => {
    const l = addPrompt([], "1", "", "find cheap flights to Oslo");
    assert.equal(l[0].name, "find cheap flights to Oslo");
    assert.deepEqual(addPrompt(l, "2", "x", "  "), l);
    assert.deepEqual(parsePrompts(JSON.stringify([...l, { id: "", text: "x" }, "junk"])), l);
    assert.deepEqual(removeById(l, "1"), []);
  });
  it("routines", () => {
    const r = upsertRoutine([], { id: "r", name: "", items: [{ kind: "workflow", id: 2 }, { kind: "goal", goal: " " }, { kind: "goal", goal: "x" }], continueOnFail: false });
    assert.deepEqual(r, [{ id: "r", name: "Routine", items: [{ kind: "workflow", id: 2 }, { kind: "goal", goal: "x" }], continueOnFail: false }]);
    assert.deepEqual(parseRoutines("{}"), []);
    assert.equal(continueAfter("done", false), true);
    assert.equal(continueAfter("failed", false), false);
    assert.equal(continueAfter("failed", true), true);
    assert.equal(continueAfter("cancelled", true), false);
    assert.equal(continueAfter(null, true), false);
  });
});

describe("job preview + memory", () => {
  it("preview lines and enable gate", () => {
    const lines = previewLines({ name: "J", goal: "g", workflow_id: null, every_minutes: 60 }, ep({ outcome: "dry", steps: [{ obs: "h", action: { type: "purchase", target: "1" }, ok: true, changed: false }] }));
    assert.ok(lines.some((l) => /DENIED/.test(l)));
    assert.equal(canEnable(1, true, new Set()), false);
    assert.equal(canEnable(1, false, new Set()), true);
    assert.equal(canEnable(1, true, new Set([1])), true);
  });
  it("lessons and notes", () => {
    const l = { b: { value: 1.23456, weight: 2 }, a: { value: 0, weight: 1 } };
    assert.deepEqual(lessonRows(l).map((r) => r.key), ["a", "b"]);
    assert.deepEqual(Object.keys(dropLesson(l, "a")), ["b"]);
    assert.match(clearSummary({ notes: 2, sites: 1, lessons: 3 }), /2 note.*1 site.*3 lesson/);
    assert.equal(editNote("", " ").ok, false);
    const e = editNote("", "hello world");
    assert.ok(e.ok && e.title === "hello world");
  });
});
