// Pure helpers for the calendar's own events/tasks UI (no Tauri/React).
import type { Quick } from "./quickParse.ts";
import { dayLabel, rowDate } from "./panelLogic.ts";
import { repeatOf } from "./recur.ts";

type Row = Record<string, unknown>;

/** Agenda rows: completed tasks drop out (they stay in the Tasks list). */
export const agendaRows = <T extends Row>(rows: T[]): T[] => rows.filter((r) => r.done !== true);

export type TaskNode = { task: Row; subs: Row[] };

const dueKey = (r: Row) => String(r.due ?? "9999");

/** Top-level tasks (open first, by due date, undated last; done at the bottom) with their subtasks. */
export function taskTree(rows: Row[]): TaskNode[] {
  const tasks = rows.filter((r) => r.kind === "task");
  const subsOf = (id: unknown) => tasks.filter((r) => r.parentId === id);
  return tasks
    .filter((r) => r.parentId == null)
    .sort((a, b) => Number(a.done === true) - Number(b.done === true) || dueKey(a).localeCompare(dueKey(b)))
    .map((task) => ({ task, subs: subsOf(task.itemId) }));
}

const REPEAT_TEXT = { none: "", daily: "repeats daily", weekly: "repeats weekly", monthly: "repeats monthly" };

/** "Tomorrow · 13:00 · repeats weekly" for a row; "No date" when undated. */
export function whenText(r: Row, now: Date): string {
  const d = rowDate(r);
  const parts = [d ? dayLabel(d, now) : "No date"];
  if (d && r.allDay !== true) parts.push(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  const rep = REPEAT_TEXT[repeatOf(r.rrule as string | null)];
  if (rep) parts.push(rep);
  return parts.join(" · ");
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** What the quick-add line understood, shown before adding: "Event · Oct 30 · 13:00". */
export function previewQuick(q: Quick): string {
  const day = q.day ? `${MONTH[+q.day.slice(5, 7) - 1]} ${+q.day.slice(8, 10)}` : "no date";
  return [q.kind === "task" ? "Task" : "Event", day, q.time, REPEAT_TEXT[q.repeat]].filter(Boolean).join(" · ");
}

/** Skill args for a quick-add result. */
export const quickArgs = (q: Quick) => ({ kind: q.kind, title: q.title, day: q.day ?? "", time: q.time ?? "", repeat: q.repeat });
