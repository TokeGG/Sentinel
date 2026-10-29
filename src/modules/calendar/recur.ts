// Pure recurrence for the calendar: FREQ DAILY/WEEKLY/MONTHLY/YEARLY with
// INTERVAL, COUNT, UNTIL and (weekly) BYDAY. Day math is on UTC day numbers so
// DST never shifts a date. Days are "YYYY-MM-DD" local day keys.
const DAY = 86_400_000;
const CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const p2 = (n: number) => String(n).padStart(2, "0");

export type Repeat = "none" | "daily" | "weekly" | "monthly";
export const REPEATS: Repeat[] = ["none", "daily", "weekly", "monthly"];

/** Form choice -> stored RRULE (null for none). */
export const ruleFor = (r: Repeat): string | null => (r === "none" ? null : `FREQ=${r.toUpperCase()}`);
/** Stored RRULE -> form choice; richer rules show as their base frequency. */
export function repeatOf(rrule: string | null | undefined): Repeat {
  const f = /FREQ=(DAILY|WEEKLY|MONTHLY)/i.exec(rrule ?? "")?.[1]?.toLowerCase();
  return (f as Repeat | undefined) ?? "none";
}

const num = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const key = (n: number) => {
  const t = new Date(n);
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
};

export function parseRule(rrule: string) {
  const kv = Object.fromEntries(rrule.split(";").map((p) => p.split("=") as [string, string]));
  const interval = Math.max(1, parseInt(kv.INTERVAL ?? "1", 10) || 1);
  const count = kv.COUNT ? parseInt(kv.COUNT, 10) || null : null;
  const u = /^(\d{4})(\d{2})(\d{2})/.exec(kv.UNTIL ?? "");
  return {
    freq: (kv.FREQ ?? "").toUpperCase(),
    interval,
    count,
    until: u ? `${u[1]}-${u[2]}-${u[3]}` : null,
    byday: (kv.BYDAY ?? "").split(",").map((c) => CODES.indexOf(c.replace(/^[-+\d]+/, ""))).filter((i) => i >= 0),
  };
}

/** Days from `from` to `to` (inclusive) on which an item starting at `start` occurs. */
export function occurrenceDays(start: string, rrule: string | null, from: string, to: string): string[] {
  const s0 = num(start.slice(0, 10));
  const [a, b] = [num(from), num(to)];
  if (!rrule || !/FREQ=/i.test(rrule)) return s0 >= a && s0 <= b ? [key(s0)] : [];
  const r = parseRule(rrule);
  const end = Math.min(b, r.until ? num(r.until) : b);
  const out: string[] = [];
  let n = 0; // occurrences so far, counted from the start
  const push = (t: number) => {
    n++;
    if (t >= a) out.push(key(t));
  };
  const [y0, m0, d0] = start.slice(0, 10).split("-").map(Number);
  if (r.freq === "DAILY") {
    for (let t = s0, i = 0; t <= end && i < 20000 && (!r.count || n < r.count); t += r.interval * DAY, i++) push(t);
  } else if (r.freq === "WEEKLY") {
    const days = r.byday.length ? r.byday : [new Date(s0).getUTCDay()];
    const week0 = s0 - ((new Date(s0).getUTCDay() + 6) % 7) * DAY; // Monday of the start week
    for (let t = s0, i = 0; t <= end && i < 20000 && (!r.count || n < r.count); t += DAY, i++) {
      const weeks = Math.floor((t - week0) / (7 * DAY));
      if (weeks % r.interval === 0 && days.includes(new Date(t).getUTCDay())) push(t);
    }
  } else if (r.freq === "MONTHLY" || r.freq === "YEARLY") {
    const step = r.freq === "YEARLY" ? 12 * r.interval : r.interval;
    for (let k = 0; k < 2000 && (!r.count || n < r.count); k++) {
      const t = Date.UTC(y0, m0 - 1 + k * step, d0);
      if (t > end) break;
      if (new Date(t).getUTCDate() === d0) push(t); // Jan 31 -> skips months without a 31st
    }
  }
  return out;
}

/** The first occurrence strictly after `start`'s day, or null when the series ended. */
export function nextDay(start: string, rrule: string | null): string | null {
  if (!rrule) return null;
  const from = key(num(start.slice(0, 10)) + DAY);
  return occurrenceDays(start, rrule, from, key(num(from) + 800 * DAY))[0] ?? null;
}
