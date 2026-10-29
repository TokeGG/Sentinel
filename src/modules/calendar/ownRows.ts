// Pure: calendar_items rows -> agenda rows (events expanded into the occurrences
// near today; tasks one row each). No Tauri/DB.
import { occurrenceDays } from "./recur.ts";

export interface DbItem {
  id: number;
  kind: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: number;
  rrule: string | null;
  notes: string;
  done: number;
  parent_id: number | null;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Local "YYYY-MM-DD[THH:MM]" -> UTC ISO string (the form panelLogic.rowDate reads). */
export function localToIso(local: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local);
  if (!m) return undefined;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

export const EVENT_WINDOW = { before: 35, after: 45 }; // days around today that repeating events are expanded

export function ownRows(items: DbItem[], now: Date): Record<string, unknown>[] {
  const from = ymd(addDays(now, -EVENT_WINDOW.before));
  const to = ymd(addDays(now, EVENT_WINDOW.after));
  const out: Record<string, unknown>[] = [];
  for (const it of items) {
    const raw = {
      itemId: it.id, itemKind: it.kind, startsAt: it.starts_at, endsAt: it.ends_at, allDay: it.all_day === 1, rrule: it.rrule,
      notes: it.notes, parentId: it.parent_id,
    };
    const time = it.starts_at && it.starts_at.length > 10 ? it.starts_at.slice(10) : "";
    if (it.kind === "task") {
      out.push({
        ...raw, id: `task-${it.id}`, title: it.title, text: it.title, source: "Tasks", kind: "task", done: it.done === 1,
        task: it.done !== 1, due: it.starts_at ? localToIso(it.starts_at) : undefined,
      });
    } else if (it.starts_at) {
      for (const day of occurrenceDays(it.starts_at, it.rrule, from, to).slice(0, 400))
        out.push({ ...raw, id: `ev-${it.id}-${day}`, title: it.title, text: it.title, source: "Calendar", kind: "event", due: localToIso(day + time) });
    }
  }
  return out;
}
