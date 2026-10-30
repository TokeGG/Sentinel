// Pure productivity logic for Notes: kanban columns, journal mood, goals with milestones, meeting stamps.
export const KANBAN_COLS = ["todo", "doing", "done"] as const;
export type Col = (typeof KANBAN_COLS)[number];
export interface KCard { id: number; board: string; col: Col; title: string; pos: number }
export const byCol = (cards: KCard[], board: string) =>
  KANBAN_COLS.map((c) => ({ col: c, cards: cards.filter((k) => k.board === board && k.col === c).sort((a, b) => a.pos - b.pos) }));
/** Column one step left (-1) or right (+1); null at the edge. */
export function shiftCol(col: Col, dir: -1 | 1): Col | null {
  const i = KANBAN_COLS.indexOf(col) + dir;
  return i >= 0 && i < KANBAN_COLS.length ? KANBAN_COLS[i] : null;
}
export const boards = (cards: KCard[]) => [...new Set(["Main", ...cards.map((c) => c.board)])];
export const nextPos = (cards: KCard[], board: string, col: Col) => Math.max(0, ...cards.filter((c) => c.board === board && c.col === col).map((c) => c.pos + 1));

export const MOODS = ["awful", "low", "okay", "good", "great"];
export interface Mood { day: string; mood: number; note: string }
export function validMood(m: number) { if (!Number.isInteger(m) || m < 1 || m > 5) throw new Error("mood is 1-5"); return m; }
/** Average mood of the last n entries (null when none). */
export const moodAvg = (rows: Mood[], n = 7) => {
  const r = [...rows].sort((a, b) => b.day.localeCompare(a.day)).slice(0, n);
  return r.length ? Math.round((r.reduce((s, x) => s + x.mood, 0) / r.length) * 10) / 10 : null;
};

export interface Milestone { t: string; done: boolean }
export function parseMilestones(raw: string): Milestone[] {
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((m) => m && typeof m.t === "string").map((m) => ({ t: m.t, done: !!m.done })) : []; } catch { return []; }
}
export const goalPct = (ms: Milestone[]) => (ms.length ? Math.round((ms.filter((m) => m.done).length / ms.length) * 100) : 0);
export const toggleMs = (ms: Milestone[], i: number) => ms.map((m, k) => (k === i ? { ...m, done: !m.done } : m));
export const milestonesFrom = (lines: string) => lines.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 30).map((t) => ({ t, done: false }));

/** Meeting notes: a "[hh:mm:ss] text" line relative to the meeting start. */
export function stampLine(startMs: number, nowMs: number, text: string): string {
  const s = Math.max(0, Math.floor((nowMs - startMs) / 1000)), p = (n: number) => String(n).padStart(2, "0");
  return `[${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}] ${text.trim()}`;
}
export const meetingBody = (title: string, startedIso: string, lines: string[]) =>
  `# Meeting: ${title.trim() || "untitled"}\n\n**Started:** ${startedIso}\n\n## Notes\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
