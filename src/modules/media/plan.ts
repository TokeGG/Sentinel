// Pure time helpers for manual plans: watch-party countdown + share text, weekly streamer schedule,
// CS2 match reminders (live = inside the entered start time + duration; no extra fetching).
const pad = (n: number) => String(n).padStart(2, "0");

/** Local "YYYY-MM-DD" + "HH:MM" for the Calendar add_item skill. */
export function dayTime(ms: number): { day: string; time: string } {
  const d = new Date(ms);
  return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** "1d 2:03:04" / "2:03:04" / "started" until `start`. */
export function countdown(start: number, now: number): string {
  let s = Math.floor((start - now) / 1000);
  if (s <= 0) return "started";
  const d = Math.floor(s / 86400); s %= 86400;
  const t = `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d ? `${d}d ${t}` : t;
}

/** Copyable invite text: absolute UTC time so friends in any zone agree. */
export function partyText(title: string, start: number, link = ""): string {
  const iso = new Date(start).toISOString().slice(0, 16).replace("T", " ");
  return `Watch party: ${title.trim() || "untitled"} starts ${iso} UTC${link ? ` ${link}` : ""}`;
}

/** Start time out of a shared invite ("... starts 2026-10-30 20:00 UTC"), or null. */
export function parsePartyText(text: string): number | null {
  const m = text.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}) UTC/);
  return m ? Date.parse(`${m[1]}T${m[2]}:00Z`) : null;
}

/** Next local occurrence of weekday `dow` (0 = Sunday) at "HH:MM" at or after `now`. */
export function nextWeekly(dow: number, hhmm: string, now: number): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h || 0, m || 0, 0, 0);
  let add = (dow - d.getDay() + 7) % 7;
  if (add === 0 && d.getTime() < now) add = 7;
  d.setDate(d.getDate() + add);
  return d.getTime();
}

export const isLiveWindow = (start: number, hours: number, now: number) => now >= start && now < start + hours * 3600000;

export const validHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
