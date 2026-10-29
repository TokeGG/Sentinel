// Pure natural-language quick add: "lunch Friday 1pm", "call mom tomorrow at 5",
// "pay rent every month", "dentist oct 31 9:30am", "todo buy milk". No Tauri/DB.
import type { Repeat } from "./recur.ts";

export interface Quick {
  title: string;
  kind: "event" | "task";
  day: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:MM"
  repeat: Repeat;
}

const WD = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const plus = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const wdIndex = (s: string) => WD.findIndex((w) => w.startsWith(s.slice(0, 3).toLowerCase()));
const WDRE = "(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)";
const MONRE = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

export function parseQuick(input: string, now: Date = new Date()): Quick {
  let s = ` ${String(input ?? "").trim()} `;
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(s);
    if (m) s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length);
    return m;
  };
  const today = plus(now, 0);
  let kind: Quick["kind"] | null = null;
  if (take(/^\s*(?:todo|task|remind me to|remember to)\b[:\s]*/i)) kind = "task";

  let repeat: Repeat = "none";
  let day: Date | null = null;
  let m: RegExpExecArray | null;
  const nextWd = (i: number) => plus(today, ((i - today.getDay() + 6) % 7) + 1); // strictly after today

  if ((m = take(new RegExp(`\\bevery\\s+(${WDRE})\\b`, "i")))) { repeat = "weekly"; day = nextWd(wdIndex(m[1])); }
  else if (take(/\b(?:every\s*day|daily)\b/i)) repeat = "daily";
  else if (take(/\b(?:every\s*week|weekly)\b/i)) repeat = "weekly";
  else if (take(/\b(?:every\s*month|monthly)\b/i)) repeat = "monthly";

  if (!day) {
    if (take(/\b(?:today|tonight)\b/i)) day = today;
    else if (take(/\b(?:tomorrow|tmrw|tmr)\b/i)) day = plus(today, 1);
    else if ((m = take(/\bin\s+(\d{1,3})\s*(day|week)s?\b/i))) day = plus(today, +m[1] * (m[2].toLowerCase() === "week" ? 7 : 1));
    else if ((m = take(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) day = new Date(+m[1], +m[2] - 1, +m[3]);
    else if ((m = take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : today.getFullYear();
      day = new Date(y, +m[1] - 1, +m[2]);
      if (!m[3] && day < today) day.setFullYear(y + 1);
    } else if ((m = take(new RegExp(`\\b(${MONRE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, "i"))) || (m = take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONRE})\\b(?:,?\\s*(\\d{4}))?`, "i")))) {
      const [mon, dd] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
      const mi = MON.indexOf(mon.slice(0, 3).toLowerCase());
      const y = m[3] ? +m[3] : today.getFullYear();
      day = new Date(y, mi, +dd);
      if (!m[3] && day < today) day.setFullYear(y + 1);
    } else if ((m = take(new RegExp(`\\b(?:on\\s+)?(?:next\\s+)?(${WDRE})\\b`, "i")))) day = nextWd(wdIndex(m[1]));
  }

  let time: string | null = null;
  if ((m = take(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?!\w)/i))) {
    time = hhmm(+m[1] % 12 + (/^p/i.test(m[3]) ? 12 : 0), m[2]);
  } else if ((m = take(/\b([01]?\d|2[0-3]):([0-5]\d)\b/))) time = hhmm(+m[1], m[2]);
  else if (take(/\bnoon\b/i)) time = "12:00";
  else if (take(/\bmidnight\b/i)) time = "00:00";
  else if ((m = take(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i)) && +m[1] <= 23) time = hhmm(+m[1] >= 1 && +m[1] <= 7 ? +m[1] + 12 : +m[1], m[2]);

  if (time && !day) {
    day = today;
    if (time < `${p2(now.getHours())}:${p2(now.getMinutes())}`) day = plus(today, 1);
  }
  if (repeat !== "none" && !day) day = today;

  const title = s.replace(/\b(?:on|at|by|from|for)\s*$/i, "").replace(/^\s*(?:on|at)\s+/i, "").replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "");
  return { title: title || "Untitled", kind: kind ?? (day || time ? "event" : "task"), day: day ? ymd(day) : null, time, repeat };
}

function hhmm(h: number, min?: string): string {
  return `${p2(h % 24)}:${min ?? "00"}`;
}
