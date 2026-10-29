// Thin SQLite layer for the bot (all SQL built in sql.ts, tested). Not unit-tested: needs Tauri.
import { getDb } from "../../core/db";
import type { Episode } from "./actions";
import { BROWSER_CLASS, BROWSER_SPECS, shippedBrain } from "./brainSpecs";
import { seededRng } from "./kernel/brain";
import { newPopulation, freshenPopulation } from "./kernel/variants";
import type { Note } from "./knowledge";
import type { LearnState } from "./learn";
import type { EpisodeRow } from "./panelLogic";
import * as q from "./sql";

const run = async (x: q.Q) => (await getDb()).execute(x.sql, x.params);
const rows = async <T,>(x: q.Q) => (await getDb()).select<T[]>(x.sql, x.params);

export const addNote = (n: Note) => run(q.insertNote(n));
export const removeNote = (id: number) => run(q.deleteNote(id));
export const allNotes = () => rows<Note>(q.listNotes());
export const saveEpisode = async (e: Episode): Promise<number | undefined> => { const r = await run(q.insertEpisode(e)); await run(q.pruneEpisodes()); return r.lastInsertId; };
export const recentEpisodes = () => rows<EpisodeRow>(q.recentEpisodes(20));
export async function getEpisode(id: number): Promise<Episode | null> {
  const [r] = await rows<{ json: string; thumbs: "up" | "down" | null }>(q.episodeJson(id));
  try { return r ? { ...(JSON.parse(r.json) as Episode), thumbs: r.thumbs ?? undefined } : null; } catch { return null; }
}
export const rateEpisode = (id: number, t: "up" | "down") => run(q.setThumbs(id, t));

export async function loadLearnState(): Promise<LearnState> {
  const [p] = await rows<{ json: string }>(q.getBrain(q.popKey(BROWSER_CLASS)));
  const [l] = await rows<{ json: string }>(q.getBrain(q.lessonsKey(BROWSER_CLASS)));
  const base = shippedBrain();
  const pop = q.parsePopulation(p?.json);
  return { pop: pop ? freshenPopulation(BROWSER_SPECS, pop, base) : newPopulation(BROWSER_SPECS, BROWSER_CLASS, base, seededRng(Date.now())), lessons: q.parseLessons(l?.json) };
}
export async function saveLearnState(st: LearnState) {
  await run(q.putBrain(q.popKey(BROWSER_CLASS), st.pop));
  await run(q.putBrain(q.lessonsKey(BROWSER_CLASS), st.lessons));
}
