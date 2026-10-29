import { test } from "node:test";
import assert from "node:assert/strict";
import type { Action, ActionResult, BrowserDriver, Episode, Observation } from "./actions.ts";
import { runAgent, type AgentDeps, type Clock } from "./agent.ts";
import { DEFAULT_BROWSER_BRAIN } from "./brainSpecs.ts";
import { detectMistakes } from "./mistakes.ts";
import type { Llm } from "./llm.ts";

const mkObs = (hash = "p1"): Observation => ({ url: "https://x.test", title: "t", text: "", hash, elements: [{ id: "b1", role: "button", text: "Go", visible: true }, { id: "b2", role: "button", text: "Buy", visible: true }] });
const A = (o: Record<string, unknown>) => JSON.stringify(o);

function rig(script: string[], results: ActionResult[] | ((a: Action, n: number) => ActionResult), over: Partial<AgentDeps> = {}) {
  const acted: Action[] = [];
  const saved: Episode[] = [];
  const slept: number[] = [];
  let t = 0, li = 0, n = 0;
  const driver: BrowserDriver = {
    observe: async () => mkObs(),
    act: async (a) => { acted.push(a); return typeof results === "function" ? results(a, n++) : (results[Math.min(n++, results.length - 1)] ?? { ok: true, changed: true }); },
  };
  const llm: Llm = { decide: async () => script[Math.min(li++, script.length - 1)] };
  const clock: Clock = { now: () => t, sleep: async (ms) => { slept.push(ms); t += ms; } };
  const deps: AgentDeps = { driver, llm, clock, store: { saveEpisode: (e) => { saved.push(e); } }, confirm: async () => true, brain: { ...DEFAULT_BROWSER_BRAIN, waitAfterAction: 100, retryLimit: 1 }, ...over };
  return { deps, acted, saved, slept, llmCalls: () => li };
}
const ok: ActionResult = { ok: true, changed: true };

test("success: acts, then done; episode is stored", async () => {
  const r = rig([A({ type: "click", target: "b1" }), A({ type: "done", result: "found it" })], [ok]);
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(ep.outcome, "done");
  assert.equal(ep.result, "found it");
  assert.equal(ep.steps.length, 1);
  assert.deepEqual(r.acted, [{ type: "click", target: "b1" }]);
  assert.equal(r.saved.length, 1);
  assert.deepEqual(detectMistakes(ep), {});
});

test("failing action is retried up to retryLimit, then recorded as a failed step", async () => {
  const r = rig([A({ type: "click", target: "b1" }), A({ type: "done", result: "x" })], [{ ok: false, error: "boom", changed: false }]);
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(r.acted.length, 2);
  assert.equal(ep.steps[0].ok, false);
  assert.equal(ep.steps[0].retries, 1);
  assert.deepEqual(detectMistakes(ep), { actionFailed: 1 });
});

test("a retry that works leaves an ok step", async () => {
  const r = rig([A({ type: "click", target: "b1" }), A({ type: "done", result: "x" })], (_a, n) => (n === 0 ? { ok: false, error: "slow", changed: false } : ok));
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(ep.steps[0].ok, true);
  assert.equal(ep.steps[0].retries, 1);
});

test("strict verification treats a click with no page change as failed; lax keeps it ok", async () => {
  const s = rig([A({ type: "click", target: "b1" }), A({ type: "done", result: "x" })], [{ ok: true, changed: false }]);
  const e1 = await runAgent(s.deps, { goal: "g" });
  assert.equal(e1.steps[0].ok, false);
  assert.deepEqual(detectMistakes(e1), { noPageChange: 1 });
  const l = rig([A({ type: "click", target: "b1" }), A({ type: "done", result: "x" })], [{ ok: true, changed: false }], { brain: { ...DEFAULT_BROWSER_BRAIN, waitAfterAction: 100, verifyStrictness: 0.2 } });
  const e2 = await runAgent(l.deps, { goal: "g" });
  assert.equal(e2.steps[0].ok, true);
  assert.deepEqual(detectMistakes(e2), { noPageChange: 1 });
});

test("loop: the patience-th identical action on the same page is not executed", async () => {
  const r = rig([A({ type: "scroll", dir: "down" })], [{ ok: true, changed: false }]);
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(ep.outcome, "loop");
  assert.equal(r.acted.length, 2);
  assert.ok((detectMistakes(ep).loop ?? 0) >= 1);
});

test("max steps from the brain stops the run", async () => {
  let i = 0;
  const r = rig([], [ok], { brain: { ...DEFAULT_BROWSER_BRAIN, waitAfterAction: 10, maxStepsPerGoal: 5, loopPatience: 6 } });
  r.deps.llm = { decide: async () => A({ type: "type", target: "b1", text: `t${i++}` }) };
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(ep.outcome, "maxSteps");
  assert.equal(ep.steps.length, 5);
});

test("wall clock stops the run", async () => {
  let i = 0;
  const r = rig([], [ok], { brain: { ...DEFAULT_BROWSER_BRAIN, waitAfterAction: 20_000, wallClockSec: 30, loopPatience: 6, maxStepsPerGoal: 50 } });
  r.deps.llm = { decide: async () => A({ type: "type", target: "b1", text: `t${i++}` }) };
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(ep.outcome, "timeout");
  assert.ok(ep.steps.length >= 1 && ep.steps.length < 5);
});

test("cancel: aborting before and during the run ends it as cancelled", async () => {
  const pre = new AbortController(); pre.abort();
  const r0 = rig([A({ type: "wait" })], [ok]);
  assert.equal((await runAgent(r0.deps, { goal: "g", signal: pre.signal })).outcome, "cancelled");
  assert.equal(r0.llmCalls(), 0);
  const ac = new AbortController();
  const r1 = rig([A({ type: "wait" })], [ok]);
  r1.deps.llm = { decide: async () => { ac.abort(); return A({ type: "wait" }); } };
  const ep = await runAgent(r1.deps, { goal: "g", signal: ac.signal });
  assert.equal(ep.outcome, "cancelled");
  assert.equal(r1.acted.length, 0, "nothing runs after cancel");
  const r2 = rig([A({ type: "wait" })], [ok]);
  r2.deps.llm = { decide: async () => { throw new Error("aborted"); } };
  const ac2 = new AbortController(); ac2.abort();
  assert.equal((await runAgent(r2.deps, { goal: "g", signal: ac2.signal })).outcome, "cancelled");
});

test("unknown actions and unknown elements are refused and never executed", async () => {
  const r = rig([A({ type: "format_disk" }), A({ type: "click", target: "nope" }), A({ type: "done", result: "x" })], [ok]);
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(r.acted.length, 0);
  assert.equal(ep.steps.length, 2);
  assert.ok(ep.steps.every((s) => s.action === null && !s.ok && /refused/.test(s.error ?? "")));
  assert.equal(ep.outcome, "done");
  assert.deepEqual(detectMistakes(ep), { refused: 2 });
  const r2 = rig(["not json"], [ok]);
  const ep2 = await runAgent(r2.deps, { goal: "g" });
  assert.equal(ep2.outcome, "failed");
  assert.equal(r2.acted.length, 0);
});

test("irreversible actions need confirmation; denial ends the run without acting", async () => {
  let asked = 0;
  const deny = rig([A({ type: "purchase", target: "b2" })], [ok], { confirm: async () => { asked++; return false; } });
  const ep = await runAgent(deny.deps, { goal: "g" });
  assert.equal(ep.outcome, "denied");
  assert.equal(asked, 1);
  assert.equal(deny.acted.length, 0);
  assert.equal(ep.steps[0].error, "denied by user");
  const allow = rig([A({ type: "submit", target: "b1" }), A({ type: "done", result: "x" })], [ok], { confirm: async () => { asked++; return true; } });
  assert.equal((await runAgent(allow.deps, { goal: "g" })).outcome, "done");
  assert.deepEqual(allow.acted, [{ type: "submit", target: "b1" }]);
  assert.equal(asked, 2);
});

test("pre-approved runs skip the question; reversible actions never ask", async () => {
  const never = async () => { throw new Error("should not ask"); };
  const pre = rig([A({ type: "delete", target: "b1" }), A({ type: "done", result: "x" })], [ok], { confirm: never });
  assert.equal((await runAgent(pre.deps, { goal: "g", preApproved: true })).outcome, "done");
  const rev = rig([A({ type: "click", target: "b1" }), A({ type: "done", result: "x" })], [ok], { confirm: never });
  assert.equal((await runAgent(rev.deps, { goal: "g" })).outcome, "done");
});

test("tool actions go through the injected toolGate; blocked or ungated tools never run", async () => {
  const tools = [{ server: "s", name: "nmap_scan" }];
  const tool = A({ type: "tool", server: "s", name: "nmap_scan", args: { host: "10.0.0.1" } });
  const gated: Action[] = [];
  const blocked = rig([tool, A({ type: "done", result: "x" })], [ok], { tools, toolGate: async (a) => { gated.push(a); return { allowed: false, reason: "out of scope" }; } });
  const ep = await runAgent(blocked.deps, { goal: "g" });
  assert.equal(blocked.acted.length, 0);
  assert.equal(gated.length, 1);
  assert.match(ep.steps[0].error ?? "", /out of scope/);
  const none = rig([tool, A({ type: "done", result: "x" })], [ok], { tools });
  await runAgent(none.deps, { goal: "g" });
  assert.equal(none.acted.length, 0);
  const allowed = rig([tool, A({ type: "done", result: "x" })], [ok], { tools, toolGate: async () => ({ allowed: true, reason: "" }) });
  await runAgent(allowed.deps, { goal: "g" });
  assert.equal(allowed.acted.length, 1);
});

test("a throwing model ends the run as failed; a throwing store does not lose the episode", async () => {
  const r = rig([], [ok], { store: { saveEpisode: () => { throw new Error("db"); } } });
  r.deps.llm = { decide: async () => { throw new Error("ollama 500"); } };
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(ep.outcome, "failed");
  assert.match(ep.steps[0].error ?? "", /ollama 500/);
});

test("variant id and goal are carried into the episode", async () => {
  const r = rig([A({ type: "done", result: "x" })], [ok], { variantId: "g0v3" });
  const ep = await runAgent(r.deps, { goal: "my goal" });
  assert.deepEqual([ep.variantId, ep.goal, ep.maxSteps], ["g0v3", "my goal", 30]);
});

test("actionGate blocks any action before it runs (Lab mode)", async () => {
  const click = A({ type: "click", target: "b1" });
  const r = rig([click, A({ type: "done", result: "x" })], [ok], { actionGate: async (a) => ({ allowed: a.type !== "click", reason: "not in Lab mode" }) });
  const ep = await runAgent(r.deps, { goal: "g" });
  assert.equal(r.acted.length, 0);
  assert.match(ep.steps[0].error ?? "", /blocked: not in Lab mode/);
});
