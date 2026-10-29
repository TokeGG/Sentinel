// Pure habit streaks from checked days ("YYYY-MM-DD").
import { dayKey } from "./panelLogic.ts";

const prev = (k: string) => { const [y, m, d] = k.split("-").map(Number); return dayKey(new Date(y, m - 1, d - 1))!; };

/** Consecutive checked days ending today (or yesterday, if today is not checked yet). */
export function currentStreak(days: string[], now: Date): number {
  const set = new Set(days);
  let k = dayKey(now)!;
  if (!set.has(k)) k = prev(k);
  let n = 0;
  while (set.has(k)) { n++; k = prev(k); }
  return n;
}

export function bestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0, run = 0, last = "";
  for (const k of sorted) { run = last && prev(k) === last ? run + 1 : 1; best = Math.max(best, run); last = k; }
  return best;
}

/** The last `n` local days, oldest first, for the check grid. */
export const lastDays = (now: Date, n: number) =>
  Array.from({ length: n }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1 - i)))!);
