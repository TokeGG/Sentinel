// The browser bot's loop as a pure function over injected parts (driver, llm, clock, store, confirm, toolGate).
// observe -> ask model -> validate -> [tool gate] -> [confirm gate] -> act (retry) -> verify -> record.
// The pentest scope gate is NOT called here: tool actions go through the injected `toolGate`, which the caller wires
// to skills/mcpGate (the existing gate). With no toolGate, tool actions are refused.
import { actionKey, isIrreversible, CLICKY, NO_CHANGE, type Action, type ActionResult, type BrowserDriver, type Episode, type Observation, type Outcome, type Step } from "./actions.ts";
import { int } from "./brainSpecs.ts";
import type { Brain } from "./kernel/brain.ts";
import { parseAction, type Llm, type PromptSkill } from "./llm.ts";
import type { McpTool } from "../skills/mcpGate.ts";

export interface Clock { now(): number; sleep(ms: number): Promise<void> }
export interface AgentDeps {
  driver: BrowserDriver;
  llm: Llm;
  clock: Clock;
  store: { saveEpisode(ep: Episode): Promise<void> | void };
  /** Ask the user before an irreversible action. */
  confirm(action: Action, obs: Observation): Promise<boolean>;
  /** Gate for tool actions (MCP). Absent = tools refused. */
  toolGate?(action: Extract<Action, { type: "tool" }>): Promise<{ allowed: boolean; reason: string }>;
  brain: Brain;
  variantId?: string;
  notes?: string[];
  skills?: PromptSkill[];
  tools?: McpTool[];
}
export interface RunOpts { goal: string; /** The user already approved irreversible actions for this run. */ preApproved?: boolean; signal?: AbortSignal }

const MAX_INVALID_IN_ROW = 3;

export async function runAgent(d: AgentDeps, o: RunOpts): Promise<Episode> {
  const startedAt = d.clock.now();
  const maxSteps = int(d.brain, "maxStepsPerGoal");
  const wallMs = (d.brain.wallClockSec ?? 180) * 1000;
  const patience = int(d.brain, "loopPatience");
  const retryLimit = int(d.brain, "retryLimit");
  const steps: Step[] = [];
  let outcome: Outcome = "maxSteps";
  let result: string | undefined;
  const cancelled = () => o.signal?.aborted === true;

  loop: while (true) {
    if (cancelled()) { outcome = "cancelled"; break; }
    if (d.clock.now() - startedAt > wallMs) { outcome = "timeout"; break; }
    if (steps.length >= maxSteps) { outcome = "maxSteps"; break; }

    const obs = await d.driver.observe();
    let raw: string;
    try {
      raw = await d.llm.decide({ goal: o.goal, obs, history: steps, notes: d.notes ?? [], skills: d.skills ?? [], tools: d.tools ?? [], brain: d.brain }, o.signal);
    } catch (e) {
      if (cancelled()) { outcome = "cancelled"; break; }
      steps.push({ obs: obs.hash, action: null, ok: false, error: `model: ${(e as Error).message}`, changed: false });
      outcome = "failed";
      break;
    }
    if (cancelled()) { outcome = "cancelled"; break; }

    const parsed = parseAction(raw, { elementIds: new Set(obs.elements.map((e) => e.id)), tools: (d.tools ?? []).map((t) => ({ server: t.server, name: t.name })) });
    if (!parsed.ok) {
      steps.push({ obs: obs.hash, action: null, ok: false, error: `refused: ${parsed.error}`, changed: false });
      if (steps.slice(-MAX_INVALID_IN_ROW).filter((s) => s.action === null).length >= MAX_INVALID_IN_ROW) { outcome = "failed"; break; }
      continue;
    }
    const action = parsed.action;
    if (action.type === "done") { outcome = "done"; result = action.result; break; }
    if (action.type === "fail") { outcome = "failed"; result = action.reason; break; }

    // loop: this action would be the `patience`-th identical one in a row on an unchanged page
    const key = actionKey(action);
    const same = steps.slice(-(patience - 1)).filter((s) => s.action && actionKey(s.action) === key && s.obs === obs.hash);
    if (patience >= 2 && same.length === patience - 1) { outcome = "loop"; break; }

    const refuse = (error: string): Step => ({ obs: obs.hash, action, ok: false, error, changed: false });
    if (action.type === "tool") {
      const v = d.toolGate ? await d.toolGate(action) : { allowed: false, reason: "no tool gate" };
      if (!v.allowed) { steps.push(refuse(`tool blocked: ${v.reason}`)); continue; }
    }
    if (isIrreversible(action) && !o.preApproved) {
      if (!(await d.confirm(action, obs))) { steps.push(refuse("denied by user")); outcome = "denied"; break loop; }
      if (cancelled()) { outcome = "cancelled"; break; }
    }

    // verify: with strictness >= .5 a click that changed nothing counts as failed (and is retried)
    const strict = (d.brain.verifyStrictness ?? 0.5) >= 0.5 && CLICKY.has(action.type);
    const verify = (r: ActionResult): ActionResult => (strict && r.ok && !r.changed ? { ...r, ok: false, error: NO_CHANGE } : r);
    let res = verify(await d.driver.act(action));
    let retries = 0;
    while (!res.ok && retries < retryLimit && !cancelled()) {
      retries++;
      await d.clock.sleep(d.brain.waitAfterAction ?? 900);
      res = verify(await d.driver.act(action));
    }
    await d.clock.sleep(d.brain.waitAfterAction ?? 900);
    steps.push({ obs: obs.hash, action, ok: res.ok, error: res.error, changed: res.changed, timedOut: res.timedOut, retries });
  }

  const ep: Episode = { goal: o.goal, variantId: d.variantId, steps, outcome, maxSteps, startedAt, endedAt: d.clock.now(), result };
  try { await d.store.saveEpisode(ep); } catch { /* the run's result still goes back to the caller */ }
  return ep;
}
