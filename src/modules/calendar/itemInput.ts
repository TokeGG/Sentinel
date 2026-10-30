// Pure: validates calendar form/skill input into the fields stored in calendar_items.
import { ruleFor, type Repeat, REPEATS } from "./recur.ts";

export interface ItemFields {
  kind: "event" | "task";
  title: string;
  startsAt: string | null; // "YYYY-MM-DD" (all day / date only) or "YYYY-MM-DDTHH:MM"
  endsAt: string | null;
  allDay: boolean;
  rrule: string | null;
  notes: string;
  parentId: number | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Form/skill args -> fields. Throws a readable Error on bad input. A recurring item needs a date. */
export function toFields(a: Record<string, unknown> | undefined): ItemFields {
  const s = (k: string) => String(a?.[k] ?? "").trim();
  const kind = s("kind") === "task" ? "task" : "event";
  const title = s("title");
  if (!title) throw new Error("title is empty");
  const day = s("day");
  const time = s("time");
  if (day && !validDay(day)) throw new Error(`date "${day}" is not YYYY-MM-DD`);
  if (time && !TIME.test(time)) throw new Error(`time "${time}" is not HH:MM`);
  if (time && !day) throw new Error("a time needs a date");
  if (kind === "event" && !day) throw new Error("an event needs a date");
  const repeat = (REPEATS as string[]).includes(s("repeat")) ? (s("repeat") as Repeat) : "none";
  if (repeat !== "none" && !day) throw new Error("a repeating item needs a date");
  const pid = Number(a?.parent_id);
  // Optional link (e.g. a deal from Deals): kept in notes, where the detail card finds links.
  const url = s("url");
  const baseNotes = String(a?.notes ?? "").trim();
  const notes = /^https?:\/\/\S+$/i.test(url) && !baseNotes.includes(url) ? `${baseNotes}${baseNotes ? "\n" : ""}${url}` : baseNotes;
  return {
    kind, title, startsAt: day ? (time ? `${day}T${time}` : day) : null, endsAt: null, allDay: !!day && !time,
    rrule: ruleFor(repeat), notes, parentId: Number.isInteger(pid) && pid > 0 ? pid : null,
  };
}
