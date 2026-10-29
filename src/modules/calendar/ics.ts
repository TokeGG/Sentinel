// Pure iCalendar (RFC 5545 subset) parser/serializer for VEVENTs. No Tauri/DB/React.
// Times are kept as LOCAL strings: all-day "YYYY-MM-DD", timed "YYYY-MM-DDTHH:MM".
// UTC ("...Z") values are converted to local; TZID values are read as local
// (no timezone database here), and DURATION is ignored (end = null).
export interface IcsEvent {
  uid: string | null;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  notes: string;
  rrule: string | null;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const FREQ = /(?:^|;)FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(?:;|$)/i;

/** Joins folded lines (a line starting with space/tab continues the previous one). */
export function unfold(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

export const unescapeText = (s: string) => s.replace(/\\([nN,;\\])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
export const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function prop(line: string): { name: string; params: string; value: string } | null {
  const i = line.indexOf(":");
  if (i < 1) return null;
  const head = line.slice(0, i);
  const semi = head.indexOf(";");
  return {
    name: (semi < 0 ? head : head.slice(0, semi)).toUpperCase(),
    params: semi < 0 ? "" : head.slice(semi + 1).toUpperCase(),
    value: line.slice(i + 1),
  };
}

/** One DTSTART/DTEND value to {local string, allDay}; null if unreadable. */
export function icsTime(value: string, params: string): { s: string; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (h === undefined) return { s: `${y}-${mo}-${d}`, allDay: true };
  if (params.includes("VALUE=DATE") && !params.includes("DATE-TIME")) return { s: `${y}-${mo}-${d}`, allDay: true };
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    return { s: `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}T${p2(dt.getHours())}:${p2(dt.getMinutes())}`, allDay: false };
  }
  return { s: `${y}-${mo}-${d}T${h}:${mi}`, allDay: false };
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}

export function parseIcs(text: string): { events: IcsEvent[]; skipped: number } {
  const events: IcsEvent[] = [];
  let skipped = 0;
  let cur: Record<string, { params: string; value: string }> | null = null;
  let depth = 0; // nested components (VALARM) inside a VEVENT are ignored
  for (const line of unfold(String(text ?? ""))) {
    const up = line.trim().toUpperCase();
    if (up === "BEGIN:VEVENT") { cur = {}; depth = 0; continue; }
    if (!cur) continue;
    if (up.startsWith("BEGIN:")) { depth++; continue; }
    if (up === "END:VEVENT") {
      const ev = build(cur);
      if (ev) events.push(ev); else skipped++;
      cur = null;
      continue;
    }
    if (up.startsWith("END:")) { depth--; continue; }
    const p = prop(line);
    if (p && depth === 0 && !(p.name in cur)) cur[p.name] = { params: p.params, value: p.value };
  }
  return { events, skipped };
}

function build(p: Record<string, { params: string; value: string }>): IcsEvent | null {
  const st = p.DTSTART && icsTime(p.DTSTART.value, p.DTSTART.params);
  const title = unescapeText(p.SUMMARY?.value ?? "").trim();
  if (!st || !title) return null;
  let end: string | null = null;
  const en = p.DTEND && icsTime(p.DTEND.value, p.DTEND.params);
  if (en && en.allDay === st.allDay) {
    // DTEND of an all-day event is exclusive: store the last day instead.
    const e = st.allDay ? addDays(en.s, -1) : en.s;
    end = e > st.s ? e : null;
  }
  const rr = p.RRULE?.value.trim() ?? "";
  return {
    uid: p.UID?.value.trim() || null,
    title,
    start: st.s,
    end,
    allDay: st.allDay,
    notes: unescapeText(p.DESCRIPTION?.value ?? ""),
    rrule: FREQ.test(rr) ? rr.toUpperCase() : null,
  };
}

function fold(line: string): string {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 70) out.push((i ? " " : "") + line.slice(i, i + 70));
  return out.join("\r\n");
}

const compact = (local: string) => local.replace(/[-:]/g, "") + (local.length === 16 ? "00" : "");

export function serializeIcs(events: IcsEvent[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]|\.\d+/g, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sentinel//Calendar//EN", "CALSCALE:GREGORIAN"];
  events.forEach((e, i) => {
    lines.push("BEGIN:VEVENT", `UID:${e.uid ?? `sentinel-${i}-${compact(e.start)}`}`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${compact(e.start)}`);
      lines.push(`DTEND;VALUE=DATE:${compact(addDays(e.end ?? e.start, 1))}`);
    } else {
      lines.push(`DTSTART:${compact(e.start)}`);
      if (e.end) lines.push(`DTEND:${compact(e.end)}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.notes) lines.push(`DESCRIPTION:${escapeText(e.notes)}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
