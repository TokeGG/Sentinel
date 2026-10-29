// Spaced repetition: flashcards from `question :: answer` lines + the SM-2 schedule.
export type Card = { ease: number; interval: number; reps: number; due: string };
export type Grade = "again" | "hard" | "good" | "easy";
const Q: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

const p2 = (n: number) => String(n).padStart(2, "0");
export const dayStr = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const plus = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const newCard = (now: Date): Card => ({ ease: 2.5, interval: 0, reps: 0, due: dayStr(now) });

export function review(c: Card, grade: Grade, now: Date): Card {
  const q = Q[grade];
  let { reps, interval } = c;
  if (q < 3) { reps = 0; interval = 1; }
  else { interval = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(interval * c.ease); reps++; }
  const ease = Math.max(1.3, c.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return { ease: Math.round(ease * 100) / 100, interval, reps, due: dayStr(plus(now, interval)) };
}

export const isDue = (c: { due: string }, now: Date) => c.due <= dayStr(now);

export function parseCards(body: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  let fence = false;
  for (const line of String(body ?? "").split("\n")) {
    if (line.startsWith("```")) fence = !fence;
    const m = !fence && /^\s*(?:[-*]\s+)?(.+?)\s*::\s*(.+?)\s*$/.exec(line);
    if (m && !out.some((c) => c.q === m[1])) out.push({ q: m[1], a: m[2] });
  }
  return out;
}

/** What to write when a note is saved: new cards to add, stale questions to drop, answers to refresh. */
export function syncPlan(have: { q: string; a: string }[], want: { q: string; a: string }[]) {
  const hq = new Map(have.map((c) => [c.q, c.a]));
  return {
    add: want.filter((c) => !hq.has(c.q)),
    update: want.filter((c) => hq.has(c.q) && hq.get(c.q) !== c.a),
    remove: have.filter((c) => !want.some((w) => w.q === c.q)).map((c) => c.q),
  };
}
