import { registerModule, registry, type ModuleManifest } from "../../core/module";
import { findSkill } from "../../ui/moduleRun";
import { addDate, logTime, remove, removeDate, step, upsert, type CourseDate } from "./logic";
import { calendarArgs, upcoming } from "./plan";
import { coursesOptions, coursesSections } from "./panelLogic";
import { mutate, readState } from "./store";

type A = Record<string, unknown>;
const s = (x: unknown) => String(x ?? "");
const today = () => new Date().toISOString().slice(0, 10);

/** Due / exam date -> Calendar event through the Calendar module's add_item skill. */
async function toCalendar(a: A = {}) {
  const c = (await readState()).courses.find((x) => x.id === s(a.id));
  const d = c?.dates[Number(a.index)];
  if (!c || !d) throw new Error("No such date");
  const cal = registry.find((m) => m.id === "hub.calendar");
  if (!cal) throw new Error("The Calendar module is not available");
  return findSkill(cal, "add_item").run({ kind: "event", ...calendarArgs(c, d) });
}

// Classes and courses: progress, next lesson, due/exam dates (to Calendar on a click), notes, weekly study time.
export const coursesModule: ModuleManifest = {
  id: "hub.courses",
  name: "Courses",
  accent: "#ffff00",
  ring: "daily",
  category: "productivity",
  icon: "courses",
  description: "Track your classes and courses: progress, next lesson, due dates and exams (send them to Calendar), notes and weekly study time.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: coursesSections, options: coursesOptions },
  skills: [
    { name: "save_course", run: async (a: A = {}) => ({ ok: !!(await mutate((x) => upsert(x, a, Date.now()))) }) },
    { name: "delete_course", run: async (a: A = {}) => ({ ok: !!(await mutate((x) => remove(x, s(a.id)))) }) },
    { name: "step", run: async (a: A = {}) => ({ ok: !!(await mutate((x) => step(x, s(a.id), Number(a.delta) || 0))) }) },
    { name: "add_date", run: async (a: A = {}) => ({ ok: !!(await mutate((x) => addDate(x, s(a.id), { label: s(a.label), date: s(a.date), kind: a.kind === "exam" ? "exam" : "due" } as CourseDate))) }) },
    { name: "remove_date", run: async (a: A = {}) => ({ ok: !!(await mutate((x) => removeDate(x, s(a.id), Number(a.index)))) }) },
    { name: "log_time", run: async (a: A = {}) => ({ ok: !!(await mutate((x) => logTime(x, s(a.id), s(a.date) || today(), Number(a.mins)))) }) },
    { name: "to_calendar", run: toCalendar },
  ],
  load: async () => (await readState()).courses.map((c) => ({ ...c, title: c.name })),
  // Moon: due/exam dates in the next 7 days (a count only).
  badge: async () => upcoming((await readState()).courses, today(), 7).length,
};

registerModule(coursesModule);
