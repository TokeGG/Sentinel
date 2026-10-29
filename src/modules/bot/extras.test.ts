import { test } from "node:test";
import assert from "node:assert/strict";
import type { Episode, Observation, Step } from "./actions.ts";
import { runAgent, type AgentDeps } from "./agent.ts";
import { exportText, freshState, importState, shareState } from "./brainOps.ts";
import { DEFAULT_BROWSER_BRAIN, LAB_CLASS } from "./brainSpecs.ts";
import { clickType, eventsToWorkflow, readEvents } from "./demo.ts";
import { busyHeld, dueJobs, jobSummary, sqlTime, type Job } from "./jobs.ts";
import { bestVariant } from "./kernel/variants.ts";
import { seededRng } from "./kernel/brain.ts";
import { buildMessages, parseAction } from "./llm.ts";
import { parsePlan, planLines } from "./plan.ts";
import { hostOf, mergeSiteNote, siteLessons, withSiteNotes } from "./siteNotes.ts";
import { shouldSeed, STARTER_NOTES } from "./starterNotes.ts";
import { fillTemplate, GOAL_TEMPLATES } from "./templates.ts";
import { snapshotDue, weeklySummary, WEEK_MS } from "./weekly.ts";
import { fromEpisode, moveStep, parseSteps, removeStep, resolveEl, setStepText, workflowLlm } from "./workflow.ts";

const obs = (els = [{ id: "3", role: "textbox", text: "Search", visible: true }, { id: "4", role: "button", text: "Go", visible: true }], url = "https://www.shop.test/a"): Observation => ({ url, title: "T", text: "", hash: "h" + els.length, elements: els });
const J = (o: unknown) => JSON.stringify(o);
const ep = (steps: Step[], over: Partial<Episode> = {}): Episode => ({ goal: "find x", steps, outcome: "done", maxSteps: 30, startedAt: 0, endedAt: 1, ...over });

function rig(script: string[], over: Partial<AgentDeps> = {}) {
  let i = 0; const acted: unknown[] = [];
  const deps: AgentDeps = {
    driver: { observe: async () => obs(), act: async (a) => { acted.push(a); return { ok: true, changed: true }; } },
    llm: { decide: async () => script[Math.min(i++, script.length - 1)] },
    clock: { now: () => 0, sleep: async () => {} }, store: { saveEpisode: () => {} }, confirm: async () => true,
    brain: { ...DEFAULT_BROWSER_BRAIN }, ...over,
  };
  return { deps, acted };
}

test("templates fill the blank; empty value gives nothing", () => {
  assert.ok(GOAL_TEMPLATES.length >= 4);
  assert.match(fillTemplate("prices", "AirPods") ?? "", /AirPods.*Do not buy/);
  assert.equal(fillTemplate("prices", "  "), null);
  assert.equal(fillTemplate("nope", "x"), null);
  assert.match(fillTemplate("form", "https://a.test") ?? "", /Do NOT submit/);
});

test("plan: strict-enough parse, prompt lines, and the plan reaches the model prompt", () => {
  assert.equal(parsePlan("nope"), null);
  assert.equal(parsePlan(J({ task: "t", plan: [] })), null);
  const p = parsePlan(J({ task: "Find price", plan: ["search", 7, "read"], success: "price seen", stop: "login" }))!;
  assert.deepEqual(p.plan, ["search", "read"]);
  assert.match(planLines(p), /Success check: price seen/);
  const m = buildMessages({ goal: "g", obs: obs(), history: [], notes: [], skills: [], tools: [], brain: DEFAULT_BROWSER_BRAIN, plan: p });
  assert.match(m[1].content, /YOUR PLAN:\nTask: Find price/);
  assert.match(m[0].content, /Stop:.*sign-in/);
});

test("explain-why: parsed, clipped, kept on the step", async () => {
  const ctx = { elementIds: new Set(["4"]), tools: [] };
  const r = parseAction(J({ type: "click", target: "4", why: " the go button " }), ctx);
  assert.ok(r.ok && r.why === "the go button");
  const plain = parseAction(J({ type: "click", target: "4" }), ctx);
  assert.deepEqual(plain, { ok: true, action: { type: "click", target: "4" } });
  const { deps } = rig([J({ type: "click", target: "4", why: "submit search" }), J({ type: "done", result: "ok" })]);
  const e = await runAgent(deps, { goal: "g" });
  assert.equal(e.steps[0].why, "submit search");
  assert.deepEqual(e.steps[0].el, { role: "button", text: "Go" });
  assert.equal(e.steps[0].url, "https://www.shop.test/a");
});

test("dry run: plan + first proposed action, nothing executed, outcome dry", async () => {
  const { deps, acted } = rig([J({ type: "click", target: "4", why: "go" })], { llm: { decide: async () => J({ type: "click", target: "4" }), plan: async () => J({ task: "t", plan: ["a"] }) } });
  const e = await runAgent(deps, { goal: "g", dryRun: true });
  assert.equal(e.outcome, "dry");
  assert.equal(acted.length, 0);
  assert.equal(e.steps.length, 1);
  assert.deepEqual(e.plan?.plan, ["a"]);
});

test("step approval: asks before every action; a no stops the run; a broken plan reply is ignored", async () => {
  const asked: string[] = [];
  const yes = rig([J({ type: "click", target: "4" }), J({ type: "scroll", dir: "down" }), J({ type: "done", result: "r" })], { approve: async (a, _o, why) => { asked.push(a.type + (why ?? "")); return true; }, llm: undefined as never });
  yes.deps.llm = { decide: (() => { let i = 0; const s = [J({ type: "click", target: "4", why: "w" }), J({ type: "scroll", dir: "down" }), J({ type: "done", result: "r" })]; return async () => s[i++]; })(), plan: async () => "garbage" };
  const e = await runAgent(yes.deps, { goal: "g", approveEach: true });
  assert.deepEqual([e.outcome, asked, e.plan], ["done", ["clickw", "scroll"], null]);
  const no = rig([J({ type: "click", target: "4" })], { approve: async () => false });
  const e2 = await runAgent(no.deps, { goal: "g", approveEach: true });
  assert.deepEqual([e2.outcome, no.acted.length], ["denied", 0]);
  const none = rig([J({ type: "click", target: "4" })]);
  assert.equal((await runAgent(none.deps, { goal: "g", approveEach: true })).outcome, "denied", "no approver = nothing runs");
});

test("workflows: from an episode, resolved by role+label, replayed through the agent with its gates", async () => {
  const steps: Step[] = [
    { obs: "a", action: { type: "type", target: "3", text: "milk" }, ok: true, changed: true, el: { role: "textbox", text: "Search" } },
    { obs: "a", action: { type: "click", target: "9" }, ok: false, changed: false, el: { role: "button", text: "X" } },
    { obs: "a", action: { type: "tool", server: "s", name: "n", args: {} }, ok: true, changed: false },
    { obs: "a", action: { type: "submit", target: "4" }, ok: true, changed: true, el: { role: "button", text: "Go" } },
  ];
  const wf = fromEpisode(ep(steps), "", "https://shop.test");
  assert.deepEqual(wf.steps.map((s) => s.action.type), ["type", "submit"]);
  assert.equal(wf.name, "find x");
  assert.equal(resolveEl(obs().elements, { role: "button", text: " go " })?.id, "4");
  assert.equal(resolveEl(obs().elements, { role: "link", text: "Go" }), undefined);
  const moved = [{ id: "7", role: "textbox", text: "Search" }, { id: "8", role: "button", text: "Go" }].map((e) => ({ ...e, visible: true }));
  let confirms = 0;
  const { deps, acted } = rig([], { driver: { observe: async () => obs(moved), act: async (a) => { acted.push(a); return { ok: true, changed: true }; } }, llm: workflowLlm(wf), confirm: async () => { confirms++; return true; } });
  const e = await runAgent(deps, { goal: wf.goal });
  assert.equal(e.outcome, "done");
  assert.deepEqual(acted, [{ type: "type", target: "7", text: "milk" }, { type: "submit", target: "8" }]);
  assert.equal(confirms, 1, "the irreversible step still asks");
  const lost = rig([], { driver: { observe: async () => obs([]), act: async () => ({ ok: true, changed: true }) }, llm: workflowLlm(wf) });
  const e2 = await runAgent(lost.deps, { goal: "g" });
  assert.equal(e2.outcome, "failed");
  assert.match(e2.result ?? "", /step 1: could not find textbox "Search"/);
});

test("workflow editing helpers and tolerant parse", () => {
  const wf = eventsToWorkflow([{ kind: "click", role: "link", text: "A", url: "u" }, { kind: "type", role: "textbox", text: "Q", value: "v", url: "u" }], "n", "");
  assert.deepEqual(moveStep(wf, 0, 1).steps.map((s) => s.action.type), ["type", "click"]);
  assert.equal(moveStep(wf, 1, 1), wf);
  assert.equal(removeStep(wf, 0).steps.length, 1);
  assert.equal((setStepText(wf, 1, "new").steps[1].action as { text: string }).text, "new");
  assert.deepEqual(parseSteps("x"), []);
  assert.equal(parseSteps(J([{ action: { type: "click", target: "1" } }, { action: { type: "tool" } }, null])).length, 1);
});

test("teach-by-demo: events read defensively, passwords dropped, typing merged", () => {
  const ev = readEvents([
    { kind: "nav", url: "https://a.test/" }, { kind: "type", role: "password", text: "pw", value: "secret", url: "x" },
    { kind: "type", role: "textbox", text: "Search", value: "mi", url: "x" }, { kind: "type", role: "textbox", text: "Search", value: "milk", url: "x" },
    { kind: "click", role: "button", text: "Go", url: "x" }, { kind: "evil" }, "junk",
  ]);
  assert.ok(!ev.some((e) => e.role === "password" || JSON.stringify(e).includes("secret")));
  const wf = eventsToWorkflow(ev, " My demo ", "");
  assert.equal(wf.startUrl, "https://a.test/");
  assert.equal(wf.source, "demo");
  assert.deepEqual(wf.steps.map((s) => [s.action.type, s.el?.text, (s.action as { text?: string }).text]), [["type", "Search", "milk"], ["click", "Go", undefined]]);
  assert.deepEqual(readEvents("x"), []);
  assert.deepEqual(["Buy now", "Delete", "Log in", "Send", "Next"].map((t) => clickType("button", t)), ["purchase", "delete", "login", "submit", "click"]);
  assert.equal(clickType("submit", "Go"), "submit");
});

test("jobs: only enabled + due; minimum hourly; busy lock goes stale", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  const j = (o: Partial<Job>): Job => ({ id: 1, name: "j", goal: "g", workflow_id: null, every_minutes: 60, enabled: 1, last_run: null, ...o });
  assert.equal(sqlTime("2026-10-29 11:00:00"), Date.parse("2026-10-29T11:00:00Z"));
  assert.equal(sqlTime("bad"), null);
  assert.deepEqual(dueJobs([j({ enabled: 0 }), j({ id: 2 }), j({ id: 3, last_run: "2026-10-29 11:30:00" }), j({ id: 4, last_run: "2026-10-29 10:59:00" }), j({ id: 5, every_minutes: 1, last_run: "2026-10-29 11:30:00" })], now).map((x) => x.id), [2, 4]);
  assert.equal(busyHeld(String(now - 1000), now), true);
  assert.equal(busyHeld(String(now - 20 * 60_000), now), false);
  assert.equal(busyHeld("", now), false);
  assert.equal(busyHeld(null, now), false);
  assert.match(jobSummary("done", "price  is\n5", 3), /^done, 3 steps: price is 5$/);
});

test("site notebook: host, prompt injection as data, lessons, merge cap", async () => {
  assert.equal(hostOf("https://WWW.Shop.test/x"), "shop.test");
  assert.equal(hostOf("file:///c"), "");
  let seen: string[] = [];
  const llm = withSiteNotes({ decide: async (i) => { seen = i.notes; return "{}"; } }, [{ host: "shop.test", text: "use the top search" }]);
  await llm.decide({ goal: "g", obs: obs(), history: [], notes: ["n1"], skills: [], tools: [], brain: DEFAULT_BROWSER_BRAIN });
  assert.deepEqual(seen, ["n1", "Site notebook for shop.test: use the top search"]);
  const L = siteLessons(ep([
    { obs: "a", action: { type: "click", target: "4" }, ok: false, error: "no page change after action", changed: false, el: { role: "button", text: "Go" }, url: "https://shop.test/" },
    { obs: "a", action: { type: "type", target: "3", text: "x" }, ok: true, changed: true, el: { role: "textbox", text: "Search" }, url: "https://shop.test/" },
  ]));
  assert.deepEqual(L.get("shop.test"), ['Clicking button "Go" did nothing.', 'Typing into textbox "Search" worked.', 'Reached "find x" in 2 steps.']);
  assert.equal(mergeSiteNote("a\nb", ["b", "c"]), "a\nb\nc");
  assert.ok(mergeSiteNote("x".repeat(1990), ["y".repeat(50)]).length <= 2000);
});

test("weekly summary and snapshot roll-over", () => {
  const now = 10 * WEEK_MS;
  assert.deepEqual(weeklySummary([], now, DEFAULT_BROWSER_BRAIN, null), ["No runs in the last 7 days."]);
  const eps = [ep([], { startedAt: now - 1000 }), ep([], { startedAt: now - 2000, outcome: "failed" }), ep([], { startedAt: now - 2 * WEEK_MS }), ep([], { startedAt: now - 5, outcome: "dry" })];
  const s = weeklySummary(eps, now, { ...DEFAULT_BROWSER_BRAIN, temperature: 0.3 }, { at: now - WEEK_MS, brain: DEFAULT_BROWSER_BRAIN }, 2);
  assert.match(s[0], /^2 runs .* 1 finished \(50%\)/);
  assert.match(s.join("\n"), /"find x" x2/);
  assert.match(s.join("\n"), /temperature 0.1 -> 0.3/);
  assert.match(s.join("\n"), /2 sites/);
  assert.equal(snapshotDue(null, now), true);
  assert.equal(snapshotDue({ at: now - 1, brain: {} }, now), false);
});

test("starter notes and seeding rule", () => {
  assert.ok(STARTER_NOTES.length >= 6);
  assert.ok(STARTER_NOTES.some((n) => /cookie/i.test(n.title)) && STARTER_NOTES.some((n) => /sign in/i.test(n.text)));
  assert.equal(shouldSeed(0, null), true);
  assert.equal(shouldSeed(0, "1"), false);
  assert.equal(shouldSeed(3, null), false);
});

test("brain share between Lab and normal mode, and a two-class export/import", () => {
  const rng = seededRng(1);
  const normal = freshState({ ...DEFAULT_BROWSER_BRAIN, temperature: 0.4 }, rng);
  const lab = shareState(normal, rng, LAB_CLASS);
  assert.equal(bestVariant(lab.pop).brain.temperature, 0.4);
  const text = exportText(normal, freshState({ ...DEFAULT_BROWSER_BRAIN, retryLimit: 3 }, rng, LAB_CLASS));
  assert.deepEqual(Object.keys(JSON.parse(text)), ["browser", "lab"]);
  const back = importState(text, rng, LAB_CLASS);
  assert.ok(back.ok && bestVariant(back.state.pop).brain.retryLimit === 3);
  assert.ok(!importState(exportText(normal), rng, LAB_CLASS).ok);
});
