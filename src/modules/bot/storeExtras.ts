// SQLite layer for workflows, jobs, site notebook, starter notes, weekly snapshot and the busy lock (SQL in sqlExtras.ts).
import { getDb } from "../../core/db";
import { getSetting, setSetting } from "../skills/store";
import type { Episode } from "./actions";
import type { Brain } from "./kernel/brain";
import type { Job } from "./jobs";
import { mergeSiteNote, siteLessons, type SiteNote } from "./siteNotes";
import * as q from "./sql";
import * as x from "./sqlExtras";
import { SEEDED_KEY, shouldSeed, STARTER_NOTES } from "./starterNotes";
import type { Snapshot } from "./weekly";
import { parseSteps, type Workflow } from "./workflow";

const run = async (s: q.Q) => (await getDb()).execute(s.sql, s.params);
const rows = async <T,>(s: q.Q) => (await getDb()).select<T[]>(s.sql, s.params);

type WfRow = { id: number; name: string; goal: string; start_url: string; steps: string; source: string };
export const listWorkflows = async (): Promise<Workflow[]> =>
  (await rows<WfRow>(x.listWorkflows())).map((r) => ({ id: r.id, name: r.name, goal: r.goal, startUrl: r.start_url, steps: parseSteps(r.steps), source: r.source === "demo" ? "demo" : "run" }));
export const getWorkflow = async (id: number) => (await listWorkflows()).find((w) => w.id === id) ?? null;
export const saveWorkflow = (w: Workflow) => run(w.id ? x.updateWorkflow(w as Workflow & { id: number }) : x.insertWorkflow(w));
export const removeWorkflow = (id: number) => run(x.deleteWorkflow(id));

export const listJobs = () => rows<Job>(x.listJobs());
export const addJob = (name: string, goal: string, wf: number | null, every: number) => run(x.insertJob(name, goal, wf, every));
export const enableJob = (id: number, on: boolean) => run(x.setJobEnabled(id, on));
export const removeJob = (id: number) => run(x.deleteJob(id));
export async function recordJobRun(id: number, outcome: string, summary: string) {
  await run(x.markJobRun(id)); await run(x.insertJobRun(id, outcome, summary)); await run(x.pruneJobRuns());
}
export interface JobRun { id: number; job_id: number; name: string | null; outcome: string; summary: string; at: string }
export const jobRuns = () => rows<JobRun>(x.jobRuns());

export const siteNotes = () => rows<SiteNote>(x.listSiteNotes());
export const putSiteNote = (host: string, text: string) => (text.trim() ? run(x.putSiteNote(host, text.trim())) : run(x.deleteSiteNote(host)));
export const removeSiteNote = (host: string) => run(x.deleteSiteNote(host));
/** After a run: append what it learned per host to the notebook. */
export async function learnSites(ep: Episode) {
  const have = new Map((await siteNotes()).map((n) => [n.host, n.text]));
  for (const [host, lines] of siteLessons(ep)) await run(x.putSiteNote(host, mergeSiteNote(have.get(host) ?? "", lines)));
}

/** Seed the starter notes once into an empty notebook. */
export async function seedStarterNotes() {
  const [{ n }] = await rows<{ n: number }>({ sql: "SELECT COUNT(*) AS n FROM bot_notes", params: [] });
  if (!shouldSeed(n, await getSetting(SEEDED_KEY))) return;
  for (const note of STARTER_NOTES) await run(q.insertNote(note));
  await setSetting(SEEDED_KEY, "1");
}

export async function weekEpisodes(): Promise<Episode[]> {
  return (await rows<{ json: string }>(x.weekEpisodes())).flatMap((r) => { try { return [JSON.parse(r.json) as Episode]; } catch { return []; } });
}
export async function getSnapshot(cls: string): Promise<Snapshot | null> {
  const [r] = await rows<{ json: string }>(q.getBrain(x.snapKey(cls)));
  try { const s = JSON.parse(r?.json ?? "null"); return s && typeof s.at === "number" && s.brain ? s : null; } catch { return null; }
}
export const putSnapshot = (cls: string, brain: Brain, at: number) => run(q.putBrain(x.snapKey(cls), { at, brain }));
