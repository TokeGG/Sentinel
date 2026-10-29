// Pure SQL builders for bot_notes / bot_episodes / bot_brain (migration 28). store.ts only runs them.
import type { Episode } from "./actions.ts";
import type { Note } from "./knowledge.ts";
import type { Population } from "./kernel/variants.ts";
import type { Lessons } from "./kernel/nudge.ts";

export interface Q { sql: string; params: unknown[] }

export const insertNote = (n: Note): Q => ({ sql: "INSERT INTO bot_notes (title, source, text) VALUES ($1,$2,$3)", params: [n.title, n.source, n.text] });
export const deleteNote = (id: number): Q => ({ sql: "DELETE FROM bot_notes WHERE id = $1", params: [id] });
export const listNotes = (): Q => ({ sql: "SELECT id, title, source, text FROM bot_notes ORDER BY id", params: [] });

export const insertEpisode = (e: Episode): Q => ({
  sql: "INSERT INTO bot_episodes (goal, outcome, steps, thumbs, json) VALUES ($1,$2,$3,$4,$5)",
  params: [e.goal.slice(0, 500), e.outcome, e.steps.length, e.thumbs ?? null, JSON.stringify(e)],
});
export const episodeJson = (id: number): Q => ({ sql: "SELECT json, thumbs FROM bot_episodes WHERE id = $1", params: [id] });
export const setThumbs = (id: number, thumbs: "up" | "down"): Q => ({ sql: "UPDATE bot_episodes SET thumbs = $2 WHERE id = $1", params: [id, thumbs] });
export const recentEpisodes = (limit = 20): Q => ({ sql: "SELECT id, goal, outcome, steps, thumbs, created_at FROM bot_episodes ORDER BY id DESC LIMIT $1", params: [Math.max(1, Math.min(200, Math.floor(limit)))] });
export const pruneEpisodes = (keep = 500): Q => ({ sql: "DELETE FROM bot_episodes WHERE id NOT IN (SELECT id FROM bot_episodes ORDER BY id DESC LIMIT $1)", params: [keep] });

/** bot_brain holds one row per key: the variants state ("pop:<class>") and the running lessons ("lessons:<class>"). */
export const putBrain = (key: string, value: unknown): Q => ({ sql: "INSERT OR REPLACE INTO bot_brain (key, json) VALUES ($1,$2)", params: [key, JSON.stringify(value)] });
export const getBrain = (key: string): Q => ({ sql: "SELECT json FROM bot_brain WHERE key = $1", params: [key] });
export const popKey = (cls: string) => `pop:${cls}`;
export const lessonsKey = (cls: string) => `lessons:${cls}`;

export function parsePopulation(json: string | undefined): Population | null {
  try {
    const p = JSON.parse(json ?? "") as Population;
    return p && Array.isArray(p.variants) && p.variants.length > 0 && p.variants.every((v) => v && typeof v.id === "string" && v.brain && typeof v.brain === "object") ? p : null;
  } catch { return null; }
}
export function parseLessons(json: string | undefined): Lessons {
  try {
    const raw = JSON.parse(json ?? "{}") as Record<string, { value?: unknown; weight?: unknown }>;
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v?.value === "number" && typeof v?.weight === "number")) as Lessons;
  } catch { return {}; }
}
