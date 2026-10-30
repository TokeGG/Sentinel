// Bot memory viewer, pure part: the learned lessons (running evidence per brain number) as rows, dropping one, and
// what "Clear bot memory" removes. Notes and site notes are plain text rows edited in place.
import type { Lessons } from "./kernel/nudge.ts";

export interface LessonRow { key: string; value: string; weight: string }
const f = (n: number) => String(Math.round(n * 1000) / 1000);

export function lessonRows(l: Lessons): LessonRow[] {
  return Object.entries(l).map(([key, v]) => ({ key, value: f(v.value), weight: f(v.weight) })).sort((a, b) => a.key.localeCompare(b.key));
}
export function dropLesson(l: Lessons, key: string): Lessons {
  const { [key]: _gone, ...rest } = l;
  return rest as Lessons;
}

export interface MemoryCounts { notes: number; sites: number; lessons: number }
/** The confirm text of "Clear bot memory". */
export function clearSummary(c: MemoryCounts): string {
  return `Deletes ${c.notes} note(s), ${c.sites} site note(s) and ${c.lessons} lesson(s), and resets the brain to its shipped numbers. Workflows, jobs, routines and settings stay.`;
}

/** Checks an edited note before saving it. */
export function editNote(title: string, text: string): { ok: true; title: string; text: string } | { ok: false; error: string } {
  const t = text.trim().slice(0, 50_000);
  if (!t) return { ok: false, error: "A note cannot be empty (delete it instead)." };
  return { ok: true, title: title.trim().slice(0, 200) || t.slice(0, 60), text: t };
}
