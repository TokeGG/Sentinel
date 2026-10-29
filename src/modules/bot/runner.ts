// One bot run, end to end (Tauri-coupled glue; the decisions are in agent.ts and the pure files it uses).
// Starts only when the panel's Run button calls it. Picks a brain variant, gathers notes/skills/tools, opens the
// bot browser, runs the agent, then ALWAYS closes the browser and feeds the episode to the learning step.
import { fetch } from "@tauri-apps/plugin-http";
import { logActivity } from "../../core/db";
import { listSkills } from "../skills/registry";
import { listMcpTools } from "../skills/mcp";
import { getSetting, LOCAL_MODEL_KEY } from "../skills/store";
import type { Action, Episode, Observation } from "./actions";
import { runAgent } from "./agent";
import { int } from "./brainSpecs";
import { openBrowserDriver } from "./driver";
import { seededRng } from "./kernel/brain";
import { pickVariant } from "./kernel/variants";
import { retrieve, noteLines } from "./knowledge";
import { learnFromEpisode, type LearnState } from "./learn";
import { logDriver, logLlm, type LogFn } from "./logging";
import { makeOllamaLlm, relevantSkills } from "./llm";
import * as store from "./store";
import { botRunTool, botToolGate } from "./tools";

export interface RunRequest {
  goal: string;
  preApproved: boolean;
  showWindow: boolean;
  signal: AbortSignal;
  log: LogFn;
  confirm(a: Action, o: Observation): Promise<boolean>;
}
export interface RunResult { episode: Episode; episodeId?: number }

export async function runBot(r: RunRequest): Promise<RunResult> {
  const model = (await getSetting(LOCAL_MODEL_KEY)) ?? "";
  if (!model) throw new Error("No local model selected. Choose one in the Skills & MCP panel (Local model).");
  const st = await store.loadLearnState();
  const variant = pickVariant(st.pop, seededRng(Date.now()));
  const brain = variant.brain;
  const notes = noteLines(retrieve(await store.allNotes(), r.goal, int(brain, "lessonCount")));
  const skills = relevantSkills(r.goal, (await listSkills()).filter((s) => s.enabled).map(({ name, description, body }) => ({ name, description, body })));
  const tools = (await listMcpTools().catch(() => [])).slice(0, 20);
  r.log("info", `variant ${variant.id}; ${notes.length} notes, ${skills.length} skills, ${tools.length} tools; caps ${int(brain, "maxStepsPerGoal")} steps / ${brain.wallClockSec} s`);

  const stop = new AbortController();
  const abort = () => stop.abort();
  if (r.signal.aborted) abort(); else r.signal.addEventListener("abort", abort, { once: true });
  const drv = await openBrowserDriver({
    brain, visible: r.showWindow, runTool: botRunTool, onStopped: (why) => { r.log("warn", `browser stopped (${why})`); abort(); },
    onNav: (url, allowed) => { r.log("nav", `${allowed ? "" : "DENIED "}${url}`); void logActivity("bot", "navigate", url.slice(0, 200), allowed ? "allowed" : "denied").catch(() => {}); },
  });
  stop.signal.addEventListener("abort", () => void drv.close(), { once: true }); // Stop = the browser closes at once
  const stopped = new Promise<false>((res) => stop.signal.addEventListener("abort", () => res(false), { once: true }));

  let id: number | undefined;
  let episode: Episode;
  try {
    episode = await runAgent({
      driver: logDriver(drv.driver, r.log),
      llm: logLlm(makeOllamaLlm({ fetch, model }), r.log),
      clock: { now: () => Date.now(), sleep: (ms) => new Promise((res) => setTimeout(res, ms)) },
      store: { saveEpisode: async (e) => { id = await store.saveEpisode(e); } },
      confirm: (a, o) => Promise.race([r.confirm(a, o), stopped]),
      toolGate: botToolGate, brain, variantId: variant.id, notes, skills, tools,
    }, { goal: r.goal, preApproved: r.preApproved, signal: stop.signal });
  } finally {
    r.signal.removeEventListener("abort", abort);
    await drv.close();
  }
  void logActivity("bot", "run", r.goal.slice(0, 200), episode.outcome).catch(() => {});
  try { await learn(st, episode); } catch (e) { r.log("warn", `learning step failed: ${(e as Error).message}`); }
  return { episode, episodeId: id };
}

/** The learning step after a run: lessons -> brain, credit to the variant that played; persisted. */
export async function learn(st: LearnState, ep: Episode): Promise<void> {
  st.lessons = learnFromEpisode(st, ep, seededRng(Date.now() ^ 0x5bd1e995));
  await store.saveLearnState(st);
}
