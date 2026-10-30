// Pure extras for the offline Practice CTF: hint ladder points, timer text, daily seed, retry queue
// (puzzles are rebuilt from category + difficulty + seed), and the write-up template.
import { CTF_CATEGORIES, type CtfCategory } from "./ctfGen.ts";
import type { Difficulty } from "./gen.ts";

export const points = (hints: number, total = 3) => Math.max(10, 100 - Math.round((90 / Math.max(1, total)) * hints));
export const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
/** Same puzzle for everyone on a given day (local date), category rotates daily. */
export function dailyPick(now: Date): { seed: number; category: CtfCategory } {
  const n = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return { seed: (n * 2654435761) % 2 ** 31, category: CTF_CATEGORIES[n % CTF_CATEGORIES.length] };
}
export interface RetryItem { category: CtfCategory; difficulty: Difficulty; seed: number; title: string }
const isDiff = (v: unknown): v is Difficulty => v === "easy" || v === "medium" || v === "hard";
export function parseRetry(s: string | null): RetryItem[] {
  try {
    const v = JSON.parse(s ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && (CTF_CATEGORIES as readonly string[]).includes(x.category) && isDiff(x.difficulty) && Number.isInteger(x.seed) && typeof x.title === "string").slice(0, 30) : [];
  } catch { return []; }
}
export const addRetry = (list: RetryItem[], it: RetryItem) => [it, ...list.filter((x) => x.seed !== it.seed || x.category !== it.category)].slice(0, 30);
export const writeupTemplate = (title: string, category: string) =>
  `# ${title} (${category})\n\n## Goal\n\n## What I tried\n- \n\n## What worked\n\n## Flag\nflag{...}\n\n## Lesson learned\n`;
