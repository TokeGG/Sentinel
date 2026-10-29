import { test } from "node:test";
import assert from "node:assert/strict";
import type { Action, Episode, Step } from "./actions.ts";
import { BROWSER_SPECS, DEFAULT_BROWSER_BRAIN, LOWER_KEYS, SHIPPED_BRAINS, shippedBrain } from "./brainSpecs.ts";
import { lessonBrain, limitChange } from "./kernel/nudge.ts";
import { exportBrains, importBrains } from "./kernel/brainFile.ts";
import { TEACHES, classifyStep, countLoops, detectMistakes, episodeScore, gradedLessons, gradedOf, lessonsFromEpisode } from "./mistakes.ts";

const click = (target = "b1"): Action => ({ type: "click", target });
const step = (o: Partial<Step> = {}): Step => ({ obs: "h1", action: click(), ok: true, changed: true, ...o });
const ep = (steps: Step[], o: Partial<Episode> = {}): Episode => ({ goal: "g", steps, outcome: "done", maxSteps: 25, startedAt: 0, endedAt: 1, ...o });

test("specs are well-formed and every teaching targets a real, in-bounds number", () => {
  for (const s of BROWSER_SPECS) assert.ok(s.min <= s.default && s.default <= s.max, s.name);
  assert.equal(new Set(BROWSER_SPECS.map((s) => s.name)).size, BROWSER_SPECS.length);
  for (const t of Object.values(TEACHES)) {
    const s = BROWSER_SPECS.find((x) => x.name === t.key);
    assert.ok(s && t.value >= s.min && t.value <= s.max, t.key);
    assert.equal(LOWER_KEYS.has(t.key) ? t.value < s.default : t.value > s.default, true, `${t.key} points the right way`);
  }
  assert.deepEqual(shippedBrain(), DEFAULT_BROWSER_BRAIN);
  const f = importBrains(BROWSER_SPECS, exportBrains(BROWSER_SPECS, SHIPPED_BRAINS));
  assert.ok(f.ok && f.brains.browser.waitAfterAction === 1100);
});

test("classifyStep: one kind per step, most specific first", () => {
  assert.equal(classifyStep(step()), null);
  assert.equal(classifyStep(step({ changed: false })), "noPageChange");
  assert.equal(classifyStep(step({ action: { type: "scroll", dir: "down" }, changed: false })), null);
  assert.equal(classifyStep(step({ action: null, ok: false })), "refused");
  assert.equal(classifyStep(step({ ok: false, timedOut: true, error: "element not found" })), "timeout");
  assert.equal(classifyStep(step({ ok: false, error: "element not visible" })), "notVisible");
  assert.equal(classifyStep(step({ ok: false, error: "No such element: #x" })), "wrongElement");
  assert.equal(classifyStep(step({ ok: false, error: "target is not an input" })), "wrongElement");
  assert.equal(classifyStep(step({ ok: false, error: "boom" })), "actionFailed");
});

test("countLoops counts each run of 3+ identical actions on the same page once", () => {
  const a = step(), b = step({ action: click("b2") });
  assert.equal(countLoops([a, a]), 0);
  assert.equal(countLoops([a, a, a]), 1);
  assert.equal(countLoops([a, a, a, a, a]), 1);
  assert.equal(countLoops([a, a, a, b, a, a, a]), 2);
  assert.equal(countLoops([a, a, step({ obs: "h2" })]), 0);
});

test("detectMistakes combines step kinds, loop outcome and thumbs-down", () => {
  const c = detectMistakes(ep([step({ ok: false, error: "x" }), step({ changed: false }), step({ ok: false, timedOut: true })], { outcome: "loop", thumbs: "down" }));
  assert.deepEqual(c, { actionFailed: 1, noPageChange: 1, timeout: 1, loop: 1, thumbsDown: 1 });
  assert.deepEqual(detectMistakes(ep([step()])), {});
});

test("graded signals: steps, retries, and up-only lessons", () => {
  const g = gradedOf(ep([step({ retries: 2 }), step({ retries: 1 }), step()], { maxSteps: 3 }));
  assert.deepEqual(g, { steps: 3, retries: 3, reached: true, maxSteps: 3 });
  const l = gradedLessons(g);
  assert.equal(l.maxStepsPerGoal.value, 4);
  assert.ok(l.waitAfterAction.weight >= 12);
  assert.deepEqual(gradedLessons({ steps: 2, retries: 0, reached: true, maxSteps: 25 }), {});
  assert.deepEqual(gradedLessons({ steps: 25, retries: 0, reached: false, maxSteps: 25 }), {});
});

test("lessons: failed runs count double; end to end the brain moves a capped, right-way step", () => {
  const steps = [step({ ok: false, error: "x" }), step({ ok: false, error: "x" })];
  const win = lessonsFromEpisode(ep(steps));
  const lose = lessonsFromEpisode(ep(steps, { outcome: "failed" }));
  assert.equal(lose.waitAfterAction.weight, 2 * win.waitAfterAction.weight);
  assert.equal(win.waitAfterAction.weight, 16);
  const B = DEFAULT_BROWSER_BRAIN;
  assert.equal(lessonBrain(BROWSER_SPECS, B, win, LOWER_KEYS).waitAfterAction, 1100, "16 < min weight: not yet");
  const next = limitChange(BROWSER_SPECS, B, lessonBrain(BROWSER_SPECS, B, lose, LOWER_KEYS));
  assert.ok(next.waitAfterAction > 1100 && next.waitAfterAction <= 1100 + 0.2 * 4800);
  const loop = lessonBrain(BROWSER_SPECS, B, { loopPatience: { value: 2, weight: 150 } }, LOWER_KEYS);
  assert.ok(loop.loopPatience < 3);
});

test("episodeScore", () => {
  assert.equal(episodeScore(ep([step()], { outcome: "failed" })), 0);
  assert.equal(episodeScore(ep([step()], { thumbs: "down" })), 0.1);
  const quick = episodeScore(ep([step(), step()]));
  const slow = episodeScore(ep(Array.from({ length: 24 }, () => step())));
  assert.ok(quick > slow && slow >= 0.5 * 0.95 && quick <= 1);
  assert.ok(episodeScore(ep([step()], { thumbs: "up" })) > episodeScore(ep([step()])));
});
