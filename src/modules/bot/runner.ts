// One bot run, end to end (Tauri-coupled glue; the decisions are in agent.ts and the pure files it uses).
// Starts only when the panel's Run button calls it. Picks a brain variant, gathers notes/skills/tools, opens the
// bot browser, runs the agent, then ALWAYS closes the browser and feeds the episode to the learning step.
import { ollamaFetch as fetch } from "./ollamaFetch";
import { logActivity } from "../../core/db";
import { listSkills } from "../skills/registry";
import { listMcpTools } from "../skills/mcp";
import { getSetting, LOCAL_MODEL_KEY, setSetting } from "../skills/store";
import type { Action, BrowserDriver, Episode, Observation } from "./actions";
import type { McpTool } from "../skills/mcpGate";
import { runAgent } from "./agent";
import { BROWSER_CLASS, int, LAB_CLASS } from "./brainSpecs";
import { BUSY_KEY, busyHeld } from "./jobs";
import { withSiteNotes } from "./siteNotes";
import { learnSites, seedStarterNotes, siteNotes } from "./storeExtras";
import { workflowLlm, type Workflow } from "./workflow";
import { openBrowserDriver } from "./driver";
import { seededRng } from "./kernel/brain";
import { pickVariant } from "./kernel/variants";
import { retrieve, noteLines } from "./knowledge";
import { learnFromEpisode, type LearnState } from "./learn";
import { logDriver, logLlm, type LogFn } from "./logging";
import { makeOllamaLlm, relevantSkills } from "./llm";
import * as store from "./store";
import { botRunTool, botToolGate } from "./tools";
import { modelFor, ollamaOptions } from "./botSettings";
import { addUsage, emptyCost } from "./runCost";
import { loadRunConfig, type RunConfig } from "./runConfig";
import { siteRuleVerdict } from "./siteRules";

/** Lab mode (pentest/labBot.ts): replaces the tool list, tool execution and the action gate; the run is logged to the engagement. */
export interface LabHooks {
  startUrl: string;
  goal(userGoal: string): string;
  tools: McpTool[];
  gate(a: Action): Promise<{ allowed: boolean; reason: string }>;
  runTool(a: Extract<Action, { type: "tool" }>): Promise<string>;
  wrapDriver(d: BrowserDriver): BrowserDriver;
  /** Every top-level navigation; false = it left the scope, so the run is stopped. */
  onNav(url: string): Promise<boolean>;
}

export interface RunRequest {
  goal: string;
  preApproved: boolean;
  showWindow: boolean;
  signal: AbortSignal;
  log: LogFn;
  lab?: LabHooks;
  confirm(a: Action, o: Observation): Promise<boolean>;
  /** Plan only (nothing is done in the page). */ dryRun?: boolean;
  /** Ask before every action, showing the model's reason. */ approve?(a: Action, o: Observation, why?: string): Promise<boolean>;
  /** Replay this saved workflow instead of asking the model (same gates and confirms). */ workflow?: Workflow;
}
export interface RunResult { episode: Episode; episodeId?: number }

export async function runBot(r: RunRequest): Promise<RunResult> {
  const cfg = await loadRunConfig();
  const model = modelFor(cfg.settings, (await getSetting(LOCAL_MODEL_KEY)) ?? "");
  if (!model) throw new Error("No local model selected. Choose one in the Skills & MCP panel (Local model).");
  if (busyHeld(await getSetting(BUSY_KEY), Date.now())) throw new Error("The bot is already running (another panel or a scheduled job).");
  await setSetting(BUSY_KEY, String(Date.now()));
  try { return await runLocked(r, model, cfg); } finally { await setSetting(BUSY_KEY, "").catch(() => {}); }
}

async function runLocked(r: RunRequest, model: string, cfg: RunConfig): Promise<RunResult> {
  const cls = r.lab ? LAB_CLASS : BROWSER_CLASS;
  if (!r.lab) await seedStarterNotes().catch(() => {});
  const st = await store.loadLearnState(cls);
  const variant = pickVariant(st.pop, seededRng(Date.now()));
  const brain = cfg.settings.wallClockSec ? { ...variant.brain, wallClockSec: cfg.settings.wallClockSec } : variant.brain;
  const lab = r.lab;
  const goal = lab ? lab.goal(r.goal) : r.goal;
  const notes = lab ? [] : noteLines(retrieve(await store.allNotes(), r.goal, int(brain, "lessonCount")));
  const enabled = (await listSkills().catch(() => [])).map(({ name, description, body, categories }) => ({ name, description, body, categories }));
  const skills = relevantSkills(r.goal, enabled, 3, 1500, lab ? { only: ["lab"], categories: ["lab"] } : { scores: cfg.scores, weight: cfg.weight });
  const tools = lab ? [...lab.tools, ...(await listMcpTools().catch(() => [])).slice(0, 12)] : (await listMcpTools().catch(() => [])).slice(0, 20);
  let cost = emptyCost(r.workflow ? "" : model);
  r.log("info", `model ${model}; variant ${variant.id}; ${notes.length} notes, ${skills.length} skills${skills.length ? ` (${skills.map((s) => s.name).join(", ")})` : ""}, ${tools.length} tools; caps ${int(brain, "maxStepsPerGoal")} steps / ${brain.wallClockSec} s`);

  const stop = new AbortController();
  const abort = () => stop.abort();
  if (r.signal.aborted) abort(); else r.signal.addEventListener("abort", abort, { once: true });
  const drv = await openBrowserDriver({
    brain, visible: r.showWindow, startUrl: lab?.startUrl ?? (r.workflow?.startUrl || undefined), runTool: lab?.runTool ?? botRunTool, onStopped: (why) => { r.log("warn", `browser stopped (${why})`); abort(); },
    onNav: (url, allowed) => {
      r.log("nav", `${allowed ? "" : "DENIED "}${url}`);
      if (lab) void lab.onNav(url).then((ok) => { if (!ok) { r.log("warn", `left the engagement scope (${url}): run stopped`); abort(); } }); void logActivity("bot", "navigate", url.slice(0, 200), allowed ? "allowed" : "denied").catch(() => {}); },
  });
  stop.signal.addEventListener("abort", () => void drv.close(), { once: true }); // Stop = the browser closes at once
  const stopped = new Promise<false>((res) => stop.signal.addEventListener("abort", () => res(false), { once: true }));

  let id: number | undefined;
  let episode: Episode;
  try {
    episode = await runAgent({
      driver: logDriver(lab ? lab.wrapDriver(drv.driver) : drv.driver, r.log),
      llm: logLlm(r.workflow ? workflowLlm(r.workflow) : withSiteNotes(makeOllamaLlm({ fetch, model, options: ollamaOptions(cfg.settings, brain.temperature ?? 0.2), onReply: (j) => { cost = addUsage(cost, j); } }), lab ? [] : await siteNotes().catch(() => [])), r.log),
      clock: { now: () => Date.now(), sleep: (ms) => new Promise((res) => setTimeout(res, ms)) },
      store: { saveEpisode: async (e) => { id = await store.saveEpisode(e); } },
      confirm: (a, o) => Promise.race([r.confirm(a, o), stopped]),
      approve: r.approve && ((a, o, why) => Promise.race([r.approve!(a, o, why), stopped])),
      toolGate: lab?.gate ?? botToolGate, actionGate: lab?.gate ?? (async (a, o) => siteRuleVerdict(cfg.rules, a, o)), stepDelayMs: cfg.settings.stepDelayMs, extra: () => ({ cost }), brain, variantId: variant.id, notes, skills, tools,
    }, { goal, preApproved: lab ? false : r.preApproved, dryRun: r.dryRun, approveEach: !!r.approve, signal: stop.signal });
  } finally {
    r.signal.removeEventListener("abort", abort);
    await drv.close();
  }
  void logActivity("bot", "run", r.goal.slice(0, 200), episode.outcome).catch(() => {});
  try {
    if (episode.outcome !== "dry" && !r.workflow) await learn(st, episode, cls);
    if (!lab && episode.outcome !== "dry") await learnSites(episode);
  } catch (e) { r.log("warn", `learning step failed: ${(e as Error).message}`); }
  return { episode, episodeId: id };
}

/** The learning step after a run: lessons -> brain, credit to the variant that played; persisted. */
export async function learn(st: LearnState, ep: Episode, cls = BROWSER_CLASS): Promise<void> {
  st.lessons = learnFromEpisode(st, ep, seededRng(Date.now() ^ 0x5bd1e995));
  await store.saveLearnState(st, cls);
}
