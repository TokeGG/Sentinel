// Journal mode: daily-note titles, rotating prompts, "on this day".
import { noteTitle, type NoteRow } from "./noteLogic.ts";

const p2 = (n: number) => String(n).padStart(2, "0");
export const dayTitle = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export const PROMPTS = [
  "What went well today?", "What is one thing you want to remember from today?", "What drained your energy, and what gave it back?",
  "What are you grateful for right now?", "What did you learn today?", "What would make tomorrow a good day?", "Who did you talk to, and what stuck?",
];
export const promptFor = (d: Date) => PROMPTS[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) % PROMPTS.length];

export const dailyBody = (d: Date, extra = "") => `# ${dayTitle(d)}\n\n> ${promptFor(d)}\n\n${extra}`.trimEnd() + "\n";

export const isDaily = (n: NoteRow) => /^\d{4}-\d{2}-\d{2}$/.test(noteTitle(n.body));
export const findDaily = (notes: NoteRow[], d: Date) => notes.find((n) => noteTitle(n.body) === dayTitle(d)) ?? null;

/** Earlier-year daily notes that fall on the same month and day. */
export function onThisDay(notes: NoteRow[], d: Date): NoteRow[] {
  const md = dayTitle(d).slice(5);
  return notes
    .filter((n) => isDaily(n) && noteTitle(n.body).slice(5) === md && noteTitle(n.body).slice(0, 4) < String(d.getFullYear()))
    .sort((a, b) => noteTitle(b.body).localeCompare(noteTitle(a.body)));
}
