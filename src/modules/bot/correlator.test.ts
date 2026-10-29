import { test } from "node:test";
import assert from "node:assert/strict";
import { failureText, isTimeout, makeCorrelator, type Timers } from "./correlator.ts";

function fakeTimers() {
  const t = new Map<number, { fn: () => void; ms: number }>();
  let n = 0;
  const timers: Timers = { set: (fn, ms) => { t.set(++n, { fn, ms }); return n; }, clear: (h) => void t.delete(h as number) };
  return { timers, pending: () => t.size, fire: (h = 1) => t.get(h)?.fn(), ms: (h = 1) => t.get(h)?.ms };
}

test("a result resolves the waiting command and clears its timer", async () => {
  const f = fakeTimers(), c = makeCorrelator(f.timers);
  const p = c.expect("a", 5000);
  assert.equal(f.ms(), 5000);
  assert.equal(c.deliver({ id: "a", ok: true, json: "{}" }), true);
  assert.deepEqual(await p, { id: "a", ok: true, json: "{}" });
  assert.equal(f.pending(), 0);
  assert.equal(c.size(), 0);
});

test("results match by id, in any order; unknown or repeated ids are ignored", async () => {
  const c = makeCorrelator(fakeTimers().timers);
  const a = c.expect("a", 1), b = c.expect("b", 1);
  assert.equal(c.deliver({ id: "b", ok: true, json: "2" }), true);
  assert.equal(c.deliver({ id: "b", ok: true, json: "3" }), false);
  assert.equal(c.deliver({ id: "zzz", ok: true, json: "1" }), false);
  c.deliver({ id: "a", ok: true, json: "1" });
  assert.equal((await a).json, "1");
  assert.equal((await b).json, "2");
});

test("timeout resolves with a failure (never rejects) and a late result is ignored", async () => {
  const f = fakeTimers(), c = makeCorrelator(f.timers);
  const p = c.expect("a", 10);
  f.fire();
  const r = await p;
  assert.equal(r.ok, false);
  assert.ok(isTimeout(r));
  assert.equal(failureText(r), "timeout");
  assert.equal(c.deliver({ id: "a", ok: true, json: "{}" }), false);
});

test("cancel and failAll fail the waiting commands", async () => {
  const c = makeCorrelator(fakeTimers().timers);
  const a = c.expect("a", 1), b = c.expect("b", 1), d = c.expect("d", 1);
  c.cancel("a", "boom");
  c.failAll("closed");
  assert.equal(failureText(await a), "boom");
  assert.equal(failureText(await b), "closed");
  assert.equal(failureText(await d), "closed");
  assert.equal(c.size(), 0);
});

test("a duplicate id is a programming error", () => {
  const c = makeCorrelator(fakeTimers().timers);
  void c.expect("a", 1);
  assert.throws(() => c.expect("a", 1), /duplicate/);
});

test("failureText reads json strings, other json and non-json", () => {
  assert.equal(failureText({ id: "a", ok: false, json: '"x y"' }), "x y");
  assert.equal(failureText({ id: "a", ok: false, json: '{"a":1}' }), '{"a":1}');
  assert.equal(failureText({ id: "a", ok: false, json: "not json" }), "not json");
});
