// Panel write operations for workflows, jobs, site notebook and brain sharing (manifest skills; Tauri-coupled).
import { shareState } from "./brainOps";
import { BROWSER_CLASS, LAB_CLASS } from "./brainSpecs";
import { seededRng } from "./kernel/brain";
import { readEvents, eventsToWorkflow } from "./demo";
import { hostOf } from "./siteNotes";
import * as store from "./store";
import * as sx from "./storeExtras";
import { fromEpisode, parseSteps, type Workflow } from "./workflow";

type A = Record<string, unknown> | undefined;
const str = (v: unknown) => String(v ?? "");
const ok = { ok: true };

export async function saveRunAsWorkflow(a: A) {
  const ep = await store.getEpisode(Number(a?.id));
  if (!ep) throw new Error("That run is gone.");
  const wf = fromEpisode(ep, str(a?.name), ep.steps.find((s) => s.url)?.url ?? "");
  if (!wf.steps.length) throw new Error("That run has no page steps to save.");
  await sx.saveWorkflow(wf);
  return ok;
}
export async function saveDemo(a: A) {
  const wf = eventsToWorkflow(readEvents(a?.events), str(a?.name), str(a?.goal));
  if (!wf.steps.length) throw new Error("Nothing was recorded (clicks and typing in the bot window; password fields are never recorded).");
  await sx.saveWorkflow(wf);
  return ok;
}
export async function updateWorkflow(a: A) {
  const id = Number(a?.id);
  if (!id) throw new Error("unknown workflow");
  const wf: Workflow = { id, name: str(a?.name).slice(0, 80) || "Workflow", goal: str(a?.goal), startUrl: str(a?.startUrl), steps: parseSteps(JSON.stringify(a?.steps ?? [])), source: "run" };
  if (wf.startUrl && !hostOf(wf.startUrl)) throw new Error("The start address must be http(s).");
  await sx.saveWorkflow(wf);
  return ok;
}
export async function deleteWorkflow(a: A) { await sx.removeWorkflow(Number(a?.id)); return ok; }

export async function addJob(a: A) {
  const goal = str(a?.goal).trim(), wf = a?.workflowId ? Number(a.workflowId) : null;
  if (!goal && !wf) throw new Error("A job needs a goal or a saved workflow.");
  await sx.addJob(str(a?.name).trim() || goal.slice(0, 40) || "Job", goal || "Replay a saved workflow", wf, Number(a?.every) || 1440);
  return ok;
}
export async function enableJob(a: A) { await sx.enableJob(Number(a?.id), Boolean(a?.enabled)); return ok; }
export async function deleteJob(a: A) { await sx.removeJob(Number(a?.id)); return ok; }

export async function putSiteNote(a: A) {
  const host = hostOf(`https://${str(a?.host).trim().replace(/^https?:\/\//, "")}`);
  if (!host) throw new Error("Enter a site such as example.com");
  await sx.putSiteNote(host, str(a?.text).slice(0, 2000));
  return ok;
}
export async function deleteSiteNote(a: A) { await sx.removeSiteNote(str(a?.host)); return ok; }

/** direction "toLab" | "toNormal": the target brain starts fresh around the other mode's best brain. */
export async function shareBrain(a: A) {
  const [from, to] = a?.direction === "toNormal" ? [LAB_CLASS, BROWSER_CLASS] : [BROWSER_CLASS, LAB_CLASS];
  await store.saveLearnState(shareState(await store.loadLearnState(from), seededRng(Date.now()), to), to);
  return ok;
}
