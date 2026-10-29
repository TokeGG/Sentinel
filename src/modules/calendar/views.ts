// Pure model for the Month / Week / Day / Agenda views, drag-to-day and time blocks.
import { dayKey, rowDate } from "./panelLogic.ts";

type Row = Record<string, unknown>;
export type ViewMode = "month" | "week" | "day" | "agenda";
export const VIEW_MODES: ViewMode[] = ["month", "week", "day", "agenda"];

const at = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Monday-first week containing `d`, as 7 local dates. */
export function weekOf(d: Date): Date[] {
  const start = at(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => at(start, i));
}

/** Moves the anchor one step back/forward for the mode (month keeps the day clamped). */
export function shiftAnchor(d: Date, mode: ViewMode, dir: -1 | 1): Date {
  if (mode === "month") {
    const y = d.getFullYear(), m = d.getMonth() + dir;
    return new Date(y, m, Math.min(d.getDate(), new Date(y, m + 1, 0).getDate()));
  }
  return at(d, dir * (mode === "week" ? 7 : mode === "day" ? 1 : 14));
}

/** Rows whose date falls on local day `key`, by time. */
export function rowsOn<T extends Row>(rows: T[], key: string): T[] {
  return rows.filter((r) => { const d = rowDate(r); return d && dayKey(d) === key; })
    .sort((a, b) => rowDate(a)!.getTime() - rowDate(b)!.getTime());
}

/** New starts_at when an item is dropped on `day`: keeps its time of day, if any. */
export function moveTo(startsAt: string | null, day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("bad day");
  return startsAt && startsAt.length > 10 ? day + startsAt.slice(10) : day;
}

/** "HH:MM" -> minutes after midnight; null when invalid. */
export function toMin(s: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  return m ? +m[1] * 60 + +m[2] : null;
}
export const fmtMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export type Block = { id?: number; day: string; start_min: number; end_min: number; title: string };

/** Validates a new time block; returns an error message or null (no overlap with the day's blocks). */
export function blockError(b: Block, existing: Block[]): string | null {
  if (!b.title.trim()) return "Give the block a title";
  if (!(b.start_min >= 0 && b.end_min <= 1440 && b.start_min < b.end_min)) return "End must be after start";
  const clash = existing.find((x) => x.day === b.day && x.id !== b.id && x.start_min < b.end_min && b.start_min < x.end_min);
  return clash ? `Overlaps "${clash.title}" (${fmtMin(clash.start_min)}-${fmtMin(clash.end_min)})` : null;
}

/** Minutes blocked on a day. */
export const blockedMinutes = (blocks: Block[], day: string) => blocks.filter((b) => b.day === day).reduce((s, b) => s + b.end_min - b.start_min, 0);
