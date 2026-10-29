// Pure helpers for the Calendar & Tasks panel. All day math uses LOCAL date
// parts and whole-day counts (never ms/86400000 on local times), so DST days
// of 23/25 hours and times around midnight land on the right day.
import { ago, utcDate } from "../../ui/kit/format.ts";
import { EXTRA_SECTIONS } from "./tabs.ts";

type Row = Record<string, unknown>;

export const calendarSections = [
  { id: "add", label: "Add event or task" },
  { id: "overdue", label: "Overdue / unfiled" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "tasks", label: "Tasks" },
  { id: "ics", label: "Import / export (.ics)" },
  ...EXTRA_SECTIONS,
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");

/** Row's date: `due` (ISO or SQLite UTC datetime), else `label`; null if absent/invalid. */
export function rowDate(r: Row): Date | null {
  const s = [r.due, r.label].find((v) => typeof v === "string" && v.trim());
  if (typeof s !== "string") return null;
  const d = utcDate(s.trim());
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Local calendar day "YYYY-MM-DD"; null for an invalid Date. */
export function dayKey(d: Date): string | null {
  return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : null;
}

/** Whole local days from `a` to `b` (positive when b is later). */
function dayDiff(a: Date, b: Date): number {
  const u = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((u(b) - u(a)) / 86_400_000);
}

/** "Today", "Tomorrow", "Yesterday", "Saturday, Oct 31" within ±6 days (never a bare weekday), else "Nov 9" ("Jan 2, 2027" in another year). */
export function dayLabel(date: Date, now: Date): string {
  if (!Number.isFinite(date.getTime())) return "";
  const n = dayDiff(now, date);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  const md = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  if (Math.abs(n) <= 6) return `${WEEKDAYS[date.getDay()]}, ${md}`;
  return date.getFullYear() === now.getFullYear() ? md : `${md}, ${date.getFullYear()}`;
}

/** Overdue = a task row (`task: true`) dated before today. Other rows are activity, never overdue. */
export function isOverdue(r: Row, now: Date): boolean {
  const d = r.task === true ? rowDate(r) : null;
  return d !== null && dayDiff(now, d) < 0;
}

export type DayGroup<T> = { day: string; label: string; rows: T[] };

/** Rows grouped by local day, days ascending, rows by time; undated rows are skipped. */
export function groupByDay<T extends Row>(rows: T[], now: Date): DayGroup<T>[] {
  const dated = rows
    .map((r) => ({ r, d: rowDate(r) }))
    .filter((x): x is { r: T; d: Date } => x.d !== null)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  const groups: DayGroup<T>[] = [];
  for (const { r, d } of dated) {
    const day = dayKey(d)!;
    const last = groups[groups.length - 1];
    if (last?.day === day) last.rows.push(r);
    else groups.push({ day, label: dayLabel(d, now), rows: [r] });
  }
  return groups;
}

/** Split rows for the panel: overdue tasks, today, the other days within ±6, and a count of older ones. */
export function bucketRows<T extends Row>(rows: T[], now: Date) {
  const overdue = rows.filter((r) => isOverdue(r, now));
  const rest = rows.filter((r) => !isOverdue(r, now));
  const near = (r: T) => {
    const d = rowDate(r);
    return d !== null && Math.abs(dayDiff(now, d)) <= 6;
  };
  const groups = groupByDay(rest.filter(near), now);
  const todayKey = dayKey(now);
  return {
    overdue: groupByDay(overdue, now).flatMap((g) => g.rows),
    today: groups.find((g) => g.day === todayKey)?.rows ?? [],
    week: groups.filter((g) => g.day !== todayKey),
    older: rest.filter((r) => rowDate(r) !== null && !near(r)).length,
  };
}

export const overdueCount = (rows: Row[], now: Date) => rows.filter((r) => isOverdue(r, now)).length;

const PREFIX: Record<string, string> = { deal: "Deals", note: "Notes", watch: "Finance" };
/** Source module tag: the row's `source`, else derived from the id prefix ("note-4" -> Notes). */
export function sourceTag(r: Row): string {
  if (typeof r.source === "string" && r.source.trim()) return r.source.trim();
  return PREFIX[String(r.id ?? "").split("-")[0]] ?? "Other";
}

/** Item text without the "Deal: " / "Unfiled note: " prefix the generic list needed. */
export function itemTitle(r: Row): string {
  if (typeof r.text === "string" && r.text.trim()) return r.text.trim();
  const t = typeof r.title === "string" ? r.title.trim() : "";
  return t.replace(/^(Deal|Unfiled note):\s*/, "") || "Untitled";
}

/** Local "HH:MM" of the row's date; "" if unknown. */
export function timeText(r: Row): string {
  if (r.allDay === true) return "all day";
  const d = rowDate(r);
  return d ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : "";
}

/** Honest wording for an overdue (unfiled) item: when it was created, not a missed deadline. */
export function overdueText(r: Row, now: Date): string {
  const d = rowDate(r);
  if (r.kind === "task" && d) return `task due ${dayLabel(d, now)}`;
  const a = d ? ago(d, now) : "";
  return a ? `unfiled · created ${a === "just now" ? a : `${a} ago`}` : "unfiled";
}
