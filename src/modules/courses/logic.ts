// Courses (pure): classes and courses with progress, next lesson, due/exam dates, notes and a study-time log.
// Stored as one JSON value in app_settings `courses`; bad or missing data falls back to an empty list.
export interface CourseDate { label: string; date: string; kind: "due" | "exam" }
export interface StudyLog { date: string; mins: number }
export interface Course {
  id: string; name: string; provider: string; url: string; total: number; done: number;
  next: string; notes: string; dates: CourseDate[]; log: StudyLog[];
}
export interface CoursesState { courses: Course[]; imported: boolean; /** free-course list added once */ seeded?: boolean }
export const EMPTY: CoursesState = { courses: [], imported: false, seeded: false };
export const KEY = "courses";

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown, max = 300) => (typeof x === "string" ? x.trim().slice(0, max) : "");
const int = (x: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
export const safeUrl = (u: string) => (/^https?:\/\/\S+$/i.test(u) ? u : "");

export function cleanCourse(raw: unknown, fallbackId: string): Course | null {
  if (!isObj(raw) || !str(raw.name)) return null;
  const total = int(raw.total, 1, 9999, 10);
  const dates = (Array.isArray(raw.dates) ? raw.dates : []).filter(isObj)
    .map((d) => ({ label: str(d.label, 120) || "Due", date: str(d.date, 10), kind: d.kind === "exam" ? "exam" as const : "due" as const }))
    .filter((d) => isDay(d.date)).slice(0, 100);
  const log = (Array.isArray(raw.log) ? raw.log : []).filter(isObj)
    .map((l) => ({ date: str(l.date, 10), mins: int(l.mins, 0, 1440, 0) })).filter((l) => isDay(l.date) && l.mins > 0).slice(-1000);
  return {
    id: str(raw.id, 60) || fallbackId, name: str(raw.name, 120), provider: str(raw.provider, 120), url: safeUrl(str(raw.url, 500)),
    total, done: int(raw.done, 0, total, 0), next: str(raw.next, 200), notes: str(raw.notes, 5000), dates, log,
  };
}

export function parseState(raw: string | null | undefined): CoursesState {
  try {
    const o = JSON.parse(raw ?? "") as unknown;
    if (!isObj(o)) return EMPTY;
    const list = (Array.isArray(o.courses) ? o.courses : []).map((c, i) => cleanCourse(c, `c${i + 1}`)).filter((c): c is Course => !!c);
    const seen = new Set<string>();
    return { courses: list.filter((c) => !seen.has(c.id) && seen.add(c.id)), imported: o.imported === true, seeded: o.seeded === true };
  } catch { return EMPTY; }
}

export const newId = (s: CoursesState, now: number) => { let id = `c${now.toString(36)}`; while (s.courses.some((c) => c.id === id)) id += "x"; return id; };

/** Adds or replaces (by id) one course; a new course keeps its dates/log empty unless given. */
export function upsert(s: CoursesState, raw: unknown, now: number): CoursesState {
  const c = cleanCourse(raw, newId(s, now));
  if (!c) throw new Error("A course needs a name");
  const i = s.courses.findIndex((x) => x.id === c.id);
  return { ...s, courses: i < 0 ? [...s.courses, c] : s.courses.map((x, j) => (j === i ? c : x)) };
}
const edit = (s: CoursesState, id: string, f: (c: Course) => Course): CoursesState => {
  if (!s.courses.some((c) => c.id === id)) throw new Error("No such course");
  return { ...s, courses: s.courses.map((c) => (c.id === id ? cleanCourse(f(c), c.id)! : c)) };
};
export const remove = (s: CoursesState, id: string): CoursesState => ({ ...s, courses: s.courses.filter((c) => c.id !== id) });
export const step = (s: CoursesState, id: string, delta: number) => edit(s, id, (c) => ({ ...c, done: Math.min(c.total, Math.max(0, c.done + delta)) }));
export const addDate = (s: CoursesState, id: string, d: CourseDate) => {
  if (!isDay(d.date)) throw new Error("Pick a date");
  return edit(s, id, (c) => ({ ...c, dates: [...c.dates, d].sort((a, b) => a.date.localeCompare(b.date)) }));
};
export const removeDate = (s: CoursesState, id: string, index: number) => edit(s, id, (c) => ({ ...c, dates: c.dates.filter((_, i) => i !== index) }));
export const logTime = (s: CoursesState, id: string, date: string, mins: number) => {
  if (!isDay(date) || !(mins > 0)) throw new Error("Give a date and minutes");
  return edit(s, id, (c) => ({ ...c, log: [...c.log, { date, mins: Math.round(mins) }] }));
};

export const pct = (c: Course) => Math.round((c.done / c.total) * 100);
export const finished = (c: Course) => c.done >= c.total;
