import { test } from "node:test";
import assert from "node:assert/strict";
import type { Episode } from "./actions.ts";
import { BROWSER_SPECS, DEFAULT_BROWSER_BRAIN, shippedBrain } from "./brainSpecs.ts";
import { brainRows, exportText, freshState, importState, resetState, thumbsDownEpisode, variantRows } from "./brainOps.ts";
import { seededRng } from "./kernel/brain.ts";
import { lessonsFromEpisode } from "./mistakes.ts";

const rng = () => seededRng(7);

test("export then import round-trips the active brain into a fresh population", () => {
  const st = freshState({ ...DEFAULT_BROWSER_BRAIN, temperature: 0.5, retryLimit: 4 }, rng());
  const text = exportText(st);
  assert.deepEqual(Object.keys(JSON.parse(text)), ["browser"]);
  const back = importState(text, rng());
  assert.ok(back.ok);
  if (back.ok) {
    assert.equal(back.state.pop.variants.length, 6);
    assert.equal(back.state.pop.variants[0].brain.retryLimit, 4);
    assert.deepEqual(back.state.lessons, {});
  }
});

test("import rejects junk, other classes, and clamps out-of-range numbers", () => {
  assert.equal(importState("{nope", rng()).ok, false);
  assert.equal(importState("[]", rng()).ok, false);
  const other = importState('{"warrior":{"x":1}}', rng());
  assert.ok(!other.ok && /browser/.test(other.error));
  const wild = importState('{"browser":{"temperature":99,"retryLimit":-5,"bogus":1}}', rng());
  assert.ok(wild.ok);
  if (wild.ok) {
    const b = wild.state.pop.variants[0].brain;
    assert.equal(b.temperature, 1);
    assert.equal(b.retryLimit, 0);
    assert.ok(!("bogus" in b));
  }
});

test("reset gives the shipped brain, no lessons, no record", () => {
  const st = resetState(rng());
  assert.deepEqual(st.pop.variants[0].brain, shippedBrain());
  assert.ok(st.pop.variants.every((v) => v.games === 0 && v.wins === 0));
  assert.deepEqual(st.lessons, {});
});

test("brain rows compare active to shipped and flag moved numbers", () => {
  const rows = brainRows({ ...DEFAULT_BROWSER_BRAIN, temperature: 0.5 });
  assert.equal(rows.length, BROWSER_SPECS.length);
  const t = rows.find((r) => r.name === "temperature")!;
  assert.deepEqual([t.active, t.shipped, t.moved], ["0.5", "0.2", true]);
  assert.equal(rows.filter((r) => r.moved).length, 1);
});

test("variant rows show win rate (prior when untried) and mark the best", () => {
  const st = freshState(DEFAULT_BROWSER_BRAIN, rng());
  st.pop.variants[2].games = 4;
  st.pop.variants[2].wins = 3;
  const rows = variantRows(st.pop);
  assert.equal(rows.length, 6);
  assert.equal(rows.filter((r) => r.best).length, 1);
  assert.equal(rows[2].winRate, "75%");
  assert.match(rows[0].winRate, /prior/);
});

test("a thumbs-down teaches through thumbsDown only and credits no variant", () => {
  const ep: Episode = { goal: "g", variantId: "g0v1", steps: [{ obs: "h", action: { type: "wait" }, ok: true, changed: true }], outcome: "done", maxSteps: 25, startedAt: 0, endedAt: 1 };
  const t = thumbsDownEpisode(ep);
  assert.equal(t.variantId, undefined);
  assert.equal(t.steps.length, 0);
  const l = lessonsFromEpisode(t);
  assert.deepEqual(Object.keys(l), ["confirmAt"]);
  assert.ok(l.confirmAt.weight > 0);
});
