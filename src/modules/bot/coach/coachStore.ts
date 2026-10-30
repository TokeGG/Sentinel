// SQLite + keychain glue for the Challenge Coach (SQL in coachSql.ts). The AoC session cookie lives only in the keychain.
import { getDb } from "../../../core/db";
import { deleteCredential, getCredential, setCredential } from "../../../core/credentials";
import { putSiteNote, siteNotes } from "../storeExtras";
import { mergeSiteNote } from "../siteNotes";
import type { Q } from "../sql";
import * as c from "./coachSql";
import type { Puzzle } from "./puzzles";

const rows = async <T,>(q: Q) => (await getDb()).select<T[]>(q.sql, q.params);
const run = async (q: Q) => { await (await getDb()).execute(q.sql, q.params); };

export const cachedPuzzle = async (key: string) => (await rows<Puzzle>(c.getPuzzle(key)))[0] ?? null;
export const cachedPuzzles = () => rows<Puzzle>(c.listPuzzles());
export const savePuzzle = (p: Puzzle) => run(c.putPuzzle(p));
export interface AttemptRow { id: number; puzzle_key: string; title: string; mode: string; lang: string; result: string; explanation: string; mistakes: string; topics: string; created_at: string }
export const attempts = () => rows<AttemptRow>(c.recentAttempts());

/** Save an attempt and feed its mistakes into the bot's site notebook (the learning the prompts read back). */
export async function saveAttempt(a: c.Attempt, host: string) {
  await run(c.insertAttempt(a));
  if (!a.mistakes.length) return;
  const old = (await siteNotes()).find((n) => n.host === host)?.text ?? "";
  await putSiteNote(host, mergeSiteNote(old, a.mistakes));
}
/** Past mistakes (newest first) the coach is told to avoid. */
export async function pastMistakes(): Promise<string[]> {
  const out: string[] = [];
  for (const r of await rows<{ mistakes: string }>(c.recentMistakes())) {
    try { const m = JSON.parse(r.mistakes); if (Array.isArray(m)) out.push(...m.filter((x) => typeof x === "string")); } catch { /* skip */ }
  }
  return out.slice(0, 8);
}

const SVC = "hub.bot", KEY = "aoc_session";
export const getAocCookie = () => getCredential(SVC, KEY);
export const setAocCookie = (v: string) => setCredential(SVC, KEY, v);
export const clearAocCookie = () => deleteCredential(SVC, KEY);
export const saveNotes = (key: string, notes: string) => run(c.setNotes(key, notes));
