// Pure built-in holiday/event sets. Approximate windows are marked approx (dates vary by year).
import { addDays, easter, nthWeekday, observed, ymd } from "./holidayDates.ts";

export interface Holiday { key: string; day: string; title: string; set: string; endDay?: string; approx?: boolean }
export interface HolidaySet { id: string; label: string; on: boolean }

export const HOLIDAY_SETS: HolidaySet[] = [
  { id: "us", label: "US federal holidays", on: true },
  { id: "observances", label: "Observances", on: true },
  { id: "shopping", label: "Shopping days", on: true },
  { id: "prime", label: "Prime Day (placeholder)", on: false },
  { id: "gaming", label: "Gaming sales & events", on: true },
];

type Def = [key: string, title: string, day: (y: number) => string, len?: number, approx?: boolean];
const thanks = (y: number) => nthWeekday(y, 11, 4, 4);

const DEFS: Record<string, Def[]> = {
  us: [
    ["newyear", "New Year's Day", (y) => ymd(y, 1, 1)], ["mlk", "Martin Luther King Jr. Day", (y) => nthWeekday(y, 1, 1, 3)],
    ["presidents", "Presidents' Day", (y) => nthWeekday(y, 2, 1, 3)], ["memorial", "Memorial Day", (y) => nthWeekday(y, 5, 1, -1)],
    ["juneteenth", "Juneteenth", (y) => ymd(y, 6, 19)], ["july4", "Independence Day", (y) => ymd(y, 7, 4)],
    ["labor", "Labor Day", (y) => nthWeekday(y, 9, 1, 1)], ["columbus", "Columbus Day", (y) => nthWeekday(y, 10, 1, 2)],
    ["veterans", "Veterans Day", (y) => ymd(y, 11, 11)], ["thanksgiving", "Thanksgiving", thanks], ["christmas", "Christmas Day", (y) => ymd(y, 12, 25)],
  ],
  observances: [
    ["valentine", "Valentine's Day", (y) => ymd(y, 2, 14)], ["stpatrick", "St. Patrick's Day", (y) => ymd(y, 3, 17)],
    ["easter", "Easter", easter], ["mother", "Mother's Day", (y) => nthWeekday(y, 5, 0, 2)],
    ["father", "Father's Day", (y) => nthWeekday(y, 6, 0, 3)], ["halloween", "Halloween", (y) => ymd(y, 10, 31)],
  ],
  shopping: [["blackfriday", "Black Friday", (y) => addDays(thanks(y), 1)], ["cybermonday", "Cyber Monday", (y) => addDays(thanks(y), 4)]],
  prime: [["primeday", "Prime Day", (y) => nthWeekday(y, 7, 2, 2), 2, true]],
  gaming: [
    ["steam-spring", "Steam Spring Sale", (y) => nthWeekday(y, 3, 4, 3), 7, true],
    ["steam-summer", "Steam Summer Sale", (y) => nthWeekday(y, 6, 4, -1), 14, true],
    ["steam-autumn", "Steam Autumn Sale", (y) => addDays(thanks(y), -2), 7, true],
    ["steam-winter", "Steam Winter Sale", (y) => nthWeekday(y, 12, 4, 3), 14, true],
    ["sgf", "Summer Game Fest", (y) => nthWeekday(y, 6, 5, 1), 1, true],
    ["gamescom", "Gamescom", (y) => nthWeekday(y, 8, 3, 4), 5, true],
    ["tgs", "Tokyo Game Show", (y) => nthWeekday(y, 9, 4, 4), 4, true],
    ["tga", "The Game Awards", (y) => nthWeekday(y, 12, 4, 2), 1, true],
  ],
};

/** User edits for events: key -> "YYYY-MM-DD" (moved) or "" (hidden). */
export type Edits = Record<string, string>;

export function holidaysFor(year: number, sets: string[], edits: Edits = {}): Holiday[] {
  const out: Holiday[] = [];
  for (const set of sets) for (const [key, title, fn, len = 1, approx] of DEFS[set] ?? []) {
    const id = `${key}-${year}`;
    if (edits[id] === "") continue;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(edits[id] ?? "") ? edits[id] : fn(year);
    const edited = day !== fn(year);
    out.push({ key: id, day, title, set, endDay: len > 1 ? addDays(day, len - 1) : undefined, approx: approx && !edited });
    if (set === "us") { const o = observed(day); if (o !== day) out.push({ key: `${id}-obs`, day: o, title: `${title} (observed)`, set }); }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** Enabled set ids from saved toggles (absent = default). */
export const enabledSets = (saved: Record<string, boolean>) => HOLIDAY_SETS.filter((s) => saved[s.id] ?? s.on).map((s) => s.id);

export function holidayTitle(h: Holiday): string {
  const until = h.endDay ? ` until ${h.endDay.slice(5)}` : "";
  return `${h.title}${h.approx ? " (approx" + until + ")" : until ? ` (${until.trim()})` : ""}`;
}
