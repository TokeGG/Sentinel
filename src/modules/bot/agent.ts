// The browser bot's loop as a pure function over injected parts (driver, llm, clock, store, confirm, toolGate).
// [plan] -> observe -> ask model -> validate -> [action gate] -> [tool gate] -> [step approval] -> [confirm gate] -> act -> record.
// The pentest scope gate is NOT called here: tool actions go through the injected `toolGate`, which the caller wires
// to skills/mcpGate (the existing gate). With no toolGate, tool actions are refused.
import { actionKey, isIrreversible, type Action, type BrowserDriver, type Episode, type Observation, type Outcome, type Step } from "./actions.ts";
import { actVerified } from "./agentAct.ts";
import { int } from "./brainSpecs.ts";
import type { Brain } from "./kernel/brain.ts";
import { parseAction, type Llm, type PromptSkill } from "./llm.ts";
import { parsePlan, type TaskPlan } from "./plan.ts";
import type { McpTool } from "../skills/mcpGate.ts";

export interface Clock { now(): number; sleep(ms: number): Promise<void> }
type Verdict = Promise<{ allowed: boolean; reason: string }>;
export interface AgentDeps {
  driver: BrowserDriver;
  llm: Llm;
  clock: Clock;
  store: { saveEpisode(ep: Episode): Promise<void> | void };
  /** Ask the user before an irreversible action. */
  confirm(action: Action, obs: Observation): Promise<boolean>;
  /** Step-approval mode: ask the user before EVERY action (with the model's reason). */
  approve?(action: Action, obs: Observation, why: string | undefined): Promise<boolean>;
  /** Gate for EVERY action (Lab mode: only tools and in-scope goto pass). Absent = no extra restriction. */
  actionGate?(action: Action): Verdict;
  /** Gate for tool actions (MCP). Absent = tools refused. */
  toolGate?(action: Extract<Action, { type: "tool" }>): Verdict;
  brain: Brain;
  variantId?: string;
  notes?: string[];
  skills?: PromptSkill[];
  tools?: McpTool[];
}
export interface RunOpts {
  goal: string;
  /** The user already approved irreversible actions for this run. */ preApproved?: boolean;
  /** Plan only: write the plan and the first proposed action, act on nothing. */ dryRun?: boolean;
  /** Ask (deps.approve) before every action. */ approveEach?: boolean;
  signal?: AbortSignal;
}

const MAX_INVALID_IN_ROW = 3;

async function makePlan(d: AgentDeps, goal: string, signal?: AbortSignal): Promise<TaskPlan | null> {
  if (!d.llm.plan) return null;
  try { return parsePlan(await d.llm.plan(goal, await d.driver.observe(), d.brain, signal)); } catch { return null; }
}

export async function runAgent(d: AgentDeps, o: RunOpts): Promise<Episode> {
  const startedAt = d.clock.now();
  const maxSteps = int(d.brain, "maxStepsPerGoal");
  const wallMs = (d.brain.wallClockSec ?? 180) * 1000;
  const patience = int(d.brain, "loopPatience");
  const steps: Step[] = [];
  let outcome: Outcome = "maxSteps";
  let result: string | undefined;
  const cancelled = () => o.signal?.aborted === true;
  const plan = await makePlan(d, o.goal, o.signal);

  loop: while (true) {
    if (cancelled()) { outcome = "cancelled"; break; }
    if (d.clock.now() - startedAt > wallMs) { outcome = "timeout"; break; }
    if (steps.length >= maxSteps) { outcome = "maxSteps"; break; }

    const obs = await d.driver.observe();
    let raw: string;
    try {
      raw = await d.llm.decide({ goal: o.goal, obs, history: steps, notes: d.notes ?? [], skills: d.skills ?? [], tools: d.tools ?? [], brain: d.brain, plan }, o.signal);
    } catch (e) {
      if (cancelled()) { outcome = "cancelled"; break; }
      steps.push({ obs: obs.hash, action: null, ok: false, error: `model: ${(e as Error).message}`, changed: false, url: obs.url });
      outcome = "failed";
      break;
    }
    if (cancelled()) { outcome = "cancelled"; break; }

    const parsed = parseAction(raw, { elementIds: new Set(obs.elements.map((e) => e.id)), tools: (d.tools ?? []).map((t) => ({ server: t.server, name: t.name })) });
    if (!parsed.ok) {
      steps.push({ obs: obs.hash, action: null, ok: false, error: `refused: ${parsed.error}`, changed: false, url: obs.url });
      if (steps.slice(-MAX_INVALID_IN_ROW).filter((s) => s.action === null).length >= MAX_INVALID_IN_ROW) { outcome = "failed"; break; }
      continue;
    }
    const { action, why } = parsed;
    if (action.type === "done") { outcome = o.dryRun ? "dry" : "done"; result = action.result; break; }
    if (action.type === "fail") { outcome = o.dryRun ? "dry" : "failed"; result = action.reason; break; }

    const target = "target" in action ? obs.elements.find((e) => e.id === action.target) : undefined;
    const base = { obs: obs.hash, action, why, url: obs.url, ...(target ? { el: { role: target.role, text: target.text } } : {}) };
    if (o.dryRun) { steps.push({ ...base, ok: true, changed: false, output: "dry run: not executed" }); outcome = "dry"; break; }

    // loop: this action would be the `patience`-th identical one in a row on an unchanged page
    const key = actionKey(action);
    const same = steps.slice(-(patience - 1)).filter((s) => s.action && actionKey(s.action) === key && s.obs === obs.hash);
    if (patience >= 2 && same.length === patience - 1) { outcome = "loop"; break; }

    const refuse = (error: string): Step => ({ ...base, ok: false, error, changed: false });
    if (d.actionGate) {
      const g = await d.actionGate(action);
      if (!g.allowed) { steps.push(refuse(`blocked: ${g.reason}`)); continue; }
    }
    if (action.type === "tool") {
      const v = d.toolGate ? await d.toolGate(action) : { allowed: false, reason: "no tool gate" };
      if (!v.allowed) { steps.push(refuse(`tool blocked: ${v.reason}`)); continue; }
    }
    if (o.approveEach) {
      if (!d.approve || !(await d.approve(action, obs, why))) { steps.push(refuse("denied by user")); outcome = "denied"; break loop; }
      if (cancelled()) { outcome = "cancelled"; break; }
    }
    if (isIrreversible(action) && !o.preApproved) {
      if (!(await d.confirm(action, obs))) { steps.push(refuse("denied by user")); outcome = "denied"; break loop; }
      if (cancelled()) { outcome = "cancelled"; break; }
    }
    const { res, retries } = await actVerified(d, action, cancelled);
    steps.push({ ...base, ok: res.ok, error: res.error, changed: res.changed, timedOut: res.timedOut, retries, output: res.output?.slice(0, 600) });
  }

  const ep: Episode = { goal: o.goal, variantId: d.variantId, steps, outcome, maxSteps, startedAt, endedAt: d.clock.now(), result, plan };
  try { await d.store.saveEpisode(ep); } catch { /* the run's result still goes back to the caller */ }
  return ep;
}
