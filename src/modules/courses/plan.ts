// Courses views (pure): weekly study totals, upcoming dates, sorting, the one-time Lab import and Calendar hand-off.
import { finished, parseState, type Course, type CourseDate, type CoursesState } from "./logic.ts";

const DAY = 864e5;
const dayMs = (d: string) => Date.parse(d + "T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Monday of the week that contains `day` (YYYY-MM-DD). */
export function weekStart(day: string): string {
  const ms = dayMs(day);
  return iso(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY);
}

/** Minutes per week, oldest first, for the last `weeks` weeks ending with the week of `today`. */
export function weekTotals(courses: Course[], today: string, weeks: number): { week: string; mins: number }[] {
  const last = dayMs(weekStart(today));
  const out = Array.from({ length: Math.max(1, weeks) }, (_, i) => ({ week: iso(last - (weeks - 1 - i) * 7 * DAY), mins: 0 }));
  const at = new Map(out.map((w, i) => [w.week, i]));
  for (const c of courses) for (const l of c.log) { const i = at.get(weekStart(l.date)); if (i !== undefined) out[i].mins += l.mins; }
  return out;
}

export type Upcoming = CourseDate & { courseId: string; course: string; index: number; inDays: number };
/** Due and exam dates from today to `days` ahead, soonest first. */
export function upcoming(courses: Course[], today: string, days: number): Upcoming[] {
  const t = dayMs(today);
  return courses.flatMap((c) => c.dates.map((d, index) => ({ ...d, courseId: c.id, course: c.name, index, inDays: Math.round((dayMs(d.date) - t) / DAY) })))
    .filter((u) => u.inDays >= 0 && u.inDays <= days).sort((a, b) => a.inDays - b.inDays || a.course.localeCompare(b.course));
}
export const whenText = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

export type SortKey = "name" | "progress" | "date";
const nextDate = (c: Course, today: string) => c.dates.find((d) => d.date >= today)?.date ?? "9999";
export function sortCourses(list: Course[], by: SortKey, showDone: boolean, today: string): Course[] {
  const keep = showDone ? list : list.filter((c) => !finished(c));
  const cmp: Record<SortKey, (a: Course, b: Course) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    progress: (a, b) => a.done / a.total - b.done / b.total,
    date: (a, b) => nextDate(a, today).localeCompare(nextDate(b, today)),
  };
  return [...keep].sort((a, b) => cmp[by](a, b) || a.name.localeCompare(b.name));
}

/** One-time import of the Lab hub's courses (app_settings `lab_hub`, {courses: [{name,total,done}]}); skips names already here. */
export function importLab(s: CoursesState, labHubRaw: string | null, now: number): CoursesState {
  if (s.imported) return s;
  let list: unknown[] = [];
  try { const o = JSON.parse(labHubRaw ?? "") as { courses?: unknown }; if (Array.isArray(o?.courses)) list = o.courses; } catch { /* nothing to import */ }
  const have = new Set(s.courses.map((c) => c.name.toLowerCase()));
  const added = list.flatMap((c, i) => {
    const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name || have.has(name.toLowerCase())) return [];
    have.add(name.toLowerCase());
    return [{ id: `lab${now.toString(36)}${i}`, name, provider: "Pentest Lab", total: o.total, done: o.done }];
  });
  return parseState(JSON.stringify({ courses: [...s.courses, ...added], imported: true }));
}

/** Arguments for the Calendar module's add_item skill. */
export function calendarArgs(c: Course, d: CourseDate) {
  return { title: `${d.kind === "exam" ? "Exam" : "Due"}: ${d.label} (${c.name})`, day: d.date, notes: [c.provider, c.url].filter(Boolean).join(" ") };
}
