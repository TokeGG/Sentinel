import { test } from "node:test";
import assert from "node:assert/strict";
import { clampBrain, defaultBrain, mutateBrain, readBrain, sanityClamp, seededRng, type BrainSpec } from "./brain.ts";
import { LESSON_DECAY, lessonBrain, limitChange, mergeLessons } from "./nudge.ts";
import { EVOLVE_GAMES, POP_SIZE, addVariant, bestVariant, evolve, newPopulation, pickVariant, recordResult } from "./variants.ts";
import { exportBrains, importBrains } from "./brainFile.ts";

const S: BrainSpec[] = [
  { name: "a", min: 0, max: 10, default: 5 },
  { name: "b", min: 0, max: 1, default: 0.5 },
  { name: "c", min: 2, max: 6, default: 3 },
];
const base = defaultBrain(S);

test("seededRng is deterministic and in [0,1)", () => {
  const r1 = seededRng(7), r2 = seededRng(7), r3 = seededRng(8);
  const a = [r1(), r1(), r1()];
  assert.deepEqual(a, [r2(), r2(), r2()]);
  assert.notDeepEqual(a, [r3(), r3(), r3()]);
  assert.ok(a.every((x) => x >= 0 && x < 1));
});

test("clampBrain / readBrain are tolerant of missing, bad and unknown keys", () => {
  assert.deepEqual(clampBrain(S, { a: 99, b: -1, zzz: 5 }), { a: 10, b: 0, c: 3 });
  assert.deepEqual(readBrain(S, { a: "x", b: NaN, c: 4 }), { a: 5, b: 0.5, c: 4 });
  assert.deepEqual(readBrain(S, null), base);
  assert.deepEqual(readBrain(S, [1, 2]), base);
  assert.deepEqual(readBrain(S, { a: undefined }, { a: 7, b: 0.1, c: 2 }), { a: 7, b: 0.1, c: 2 });
});

test("mutateBrain stays in bounds and is seed-reproducible", () => {
  const m1 = mutateBrain(S, base, seededRng(3), 0.5, 1);
  assert.deepEqual(m1, mutateBrain(S, base, seededRng(3), 0.5, 1));
  assert.notDeepEqual(m1, base);
  for (const s of S) assert.ok(m1[s.name] >= s.min && m1[s.name] <= s.max);
  assert.deepEqual(mutateBrain(S, base, seededRng(3), 0.5, 0), base);
});

test("sanityClamp limits drift from the shipped brain (60% default, per-key room)", () => {
  const far = { a: 10, b: 1, c: 6 };
  const c = sanityClamp(S, far, base);
  assert.deepEqual([c.a, c.b, Math.round(c.c * 1000) / 1000], [10, 1, 5.4]);
  assert.equal(sanityClamp(S, far, base, 0.6, { a: 0.1 }).a, 6);
});

test("limitChange caps one nudge at 1/5 of range", () => {
  const out = limitChange(S, base, { a: 10, b: 0, c: 6 });
  assert.equal(out.a, 7);
  assert.ok(Math.abs(out.b - 0.3) < 1e-9);
  assert.ok(Math.abs(out.c - 3.8) < 1e-9);
});

test("lessonBrain moves toward evidence only in the lesson's direction, scaled by weight", () => {
  const up = lessonBrain(S, base, { a: { value: 9, weight: 150 } });
  assert.equal(up.a, 5 + 4 * 0.8);
  assert.ok(lessonBrain(S, base, { a: { value: 9, weight: 75 } }).a < up.a);
  assert.equal(lessonBrain(S, base, { a: { value: 9, weight: 19 } }).a, 5, "below min weight moves nothing");
  assert.equal(lessonBrain(S, base, { a: { value: 2, weight: 150 } }).a, 5, "wrong direction is left alone");
  assert.ok(lessonBrain(S, base, { a: { value: 2, weight: 150 } }, new Set(["a"])).a < 5, "LOWER key goes down");
  assert.equal(lessonBrain(S, base, { a: { value: 500, weight: 1e6 } }, new Set(), 1, 1).a, 10, "clamped");
  assert.equal(lessonBrain(S, base, { nope: { value: 1, weight: 99 } }).a, 5);
});

test("mergeLessons adds evidence as a weighted average and fades old evidence by 8% only when new arrives", () => {
  const m = mergeLessons({ a: { value: 8, weight: 100 }, b: { value: 1, weight: 50 } }, { a: { value: 4, weight: 92 } });
  assert.equal(LESSON_DECAY, 0.92);
  assert.equal(m.a.weight, 184);
  assert.ok(Math.abs(m.a.value - 6) < 1e-9);
  assert.deepEqual(m.b, { value: 1, weight: 50 });
  assert.equal(mergeLessons({ a: { value: 1, weight: 1190 } }, { a: { value: 1, weight: 500 } }).a.weight, 1200, "capped");
});

test("population: deterministic creation, Thompson sampling favours winners but still explores", () => {
  const p1 = newPopulation(S, "k", base, seededRng(1));
  assert.deepEqual(p1, newPopulation(S, "k", base, seededRng(1)));
  assert.equal(p1.variants.length, POP_SIZE);
  assert.deepEqual(p1.variants[0].brain, base);
  p1.variants[2].wins = 40; p1.variants[2].games = 50;
  for (const v of p1.variants) if (v !== p1.variants[2]) { v.wins = 5; v.games = 50; }
  const rng = seededRng(11);
  const counts = new Map<string, number>();
  for (let i = 0; i < 400; i++) { const id = pickVariant(p1, rng).id; counts.set(id, (counts.get(id) ?? 0) + 1); }
  assert.ok((counts.get(p1.variants[2].id) ?? 0) > 300);
  const fresh = newPopulation(S, "k", base, seededRng(2));
  const seen = new Set<string>();
  const r2 = seededRng(5);
  for (let i = 0; i < 200; i++) seen.add(pickVariant(fresh, r2).id);
  assert.equal(seen.size, POP_SIZE, "untested variants all get tried");
});

test("recordResult credits scores, ignores replaced variants, evolves after enough evidence", () => {
  const rng = seededRng(4);
  const pop = newPopulation(S, "k", base, rng);
  assert.equal(recordResult(S, pop, "gone", true, rng), false);
  recordResult(S, pop, "g0v0", false, rng, 0.5);
  assert.deepEqual([pop.variants[0].games, pop.variants[0].wins], [1, 0.5]);
  let evolved = false;
  for (let i = 0; i < EVOLVE_GAMES * POP_SIZE && !evolved; i++) {
    const v = pop.variants[i % POP_SIZE];
    evolved = recordResult(S, pop, v.id, i % POP_SIZE === 1, rng);
  }
  assert.ok(evolved);
  assert.equal(pop.generation, 1);
  assert.equal(pop.sinceEvolve, 0);
});

test("evolve replaces the weakest with a mutation of the best and halves records", () => {
  const rng = seededRng(9);
  const pop = newPopulation(S, "k", base, rng);
  pop.variants.forEach((v, i) => { v.games = 10; v.wins = i === 3 ? 9 : i === 5 ? 0 : 5; });
  const worstId = pop.variants[5].id;
  const bestBrain = pop.variants[3].brain;
  evolve(S, pop, rng);
  assert.ok(!pop.variants.some((v) => v.id === worstId));
  const child = pop.variants[5];
  assert.deepEqual([child.games, child.wins], [0, 0]);
  assert.ok(S.every((s) => child.brain[s.name] >= s.min && child.brain[s.name] <= s.max));
  assert.notDeepEqual(child.brain, bestBrain);
  assert.equal(pop.variants[3].games, 5);
  assert.equal(bestVariant(pop).id, pop.variants[3].id);
});

test("addVariant replaces the weakest, never the best", () => {
  const pop = newPopulation(S, "k", base, seededRng(1));
  pop.variants.forEach((v, i) => { v.games = 4; v.wins = i; });
  addVariant(pop, { ...base, a: 1 }, "L");
  assert.equal(pop.variants[0].id, "L");
  assert.ok(pop.variants.some((v) => v.wins === 5));
});

test("brain file matches mmoarena's botbrain.json shape and round-trips", () => {
  const text = exportBrains(S, { browser: { a: 1.23456, b: 0.33333, c: 4 }, other: base });
  const parsed = JSON.parse(text);
  assert.deepEqual(parsed.browser, { a: 1.235, b: 0.333, c: 4 });
  const back = importBrains(S, text);
  assert.ok(back.ok && back.brains.browser.a === 1.235);
  // a file from the other project: extra keys dropped, missing filled, out-of-range clamped
  const foreign = importBrains(S, JSON.stringify({ warrior: { coverHp: 0.4, a: 99 }, notAClass: 3, mage: { b: 0.2 } }));
  assert.ok(foreign.ok);
  if (foreign.ok) {
    assert.deepEqual(foreign.brains.warrior, { a: 10, b: 0.5, c: 3 });
    assert.deepEqual(Object.keys(foreign.brains).sort(), ["mage", "warrior"]);
  }
  assert.deepEqual(importBrains(S, "{bad"), { ok: false, error: "not valid JSON" });
  assert.equal(importBrains(S, "[1]").ok, false);
  const only = importBrains(S, text, ["other"]);
  assert.ok(only.ok && Object.keys(only.brains).join() === "other");
});
