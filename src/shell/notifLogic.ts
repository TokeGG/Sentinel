// Pure notification rules (no Tauri/DB/DOM): quiet hours, per-module snooze and
// do-not-disturb, "mark all read" bases, grouping for the Master Hub. Counts
// and module ids only; message text never reaches this layer.
import type { Badges } from "./badges.ts";

export type Quiet = { on: boolean; start: number; end: number }; // minutes since local midnight
export type NotifPrefs = { snooze: Record<string, number>; dnd: string[]; quiet: Quiet; read: Record<string, number> };
export const DEFAULT_QUIET: Quiet = { on: false, start: 22 * 60, end: 7 * 60 };
export const DEFAULT_PREFS: NotifPrefs = { snooze: {}, dnd: [], quiet: DEFAULT_QUIET, read: {} };
const DAY = 1440, HOUR_MS = 3600_000;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const okId = (k: string) => k.length > 0 && k.length <= 64 && !(k in Object.prototype);
const minutes = (v: unknown, d: number) => (isNum(v) && v >= 0 && v < DAY ? Math.floor(v) : d);
function numMap(raw: unknown, min: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw))
    for (const [k, v] of Object.entries(raw)) if (okId(k) && isNum(v) && v >= min) out[k] = Math.floor(v);
  return out;
}

/** Untrusted stored JSON -> safe prefs; every field falls back independently. */
export function sanitizePrefs(raw: unknown): NotifPrefs {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const q = (typeof r.quiet === "object" && r.quiet !== null ? r.quiet : {}) as Record<string, unknown>;
  return {
    snooze: numMap(r.snooze, 1),
    dnd: Array.isArray(r.dnd) ? [...new Set(r.dnd.filter((x): x is string => typeof x === "string" && okId(x)))] : [],
    quiet: { on: q.on === true, start: minutes(q.start, DEFAULT_QUIET.start), end: minutes(q.end, DEFAULT_QUIET.end) },
    read: numMap(r.read, 0),
  };
}

export const parseHM = (s: string): number | null => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const fmtHM = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const minutesOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();

/** Inside the quiet range? It may wrap midnight (22:00-07:00); start == end is empty. */
export function inQuiet(q: Quiet, min: number): boolean {
  if (!q.on || q.start === q.end) return false;
  return q.start < q.end ? min >= q.start && min < q.end : min >= q.start || min < q.end;
}

/** Epoch ms a snooze ends: 1 hour from now, or 08:00 the next local day. */
export function snoozeUntil(kind: "1h" | "tomorrow", now: Date): number {
  if (kind === "1h") return now.getTime() + HOUR_MS;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0, 0).getTime();
}

export const isSnoozed = (p: NotifPrefs, id: string, nowMs: number): boolean => (p.snooze[id] ?? 0) > nowMs;
export const isDnd = (p: NotifPrefs, id: string): boolean => p.dnd.includes(id);
/** Why a module is muted in the hub (its count still shows there), or null. */
export const muteKind = (p: NotifPrefs, id: string, nowMs: number): "dnd" | "snooze" | null =>
  isDnd(p, id) ? "dnd" : isSnoozed(p, id, nowMs) ? "snooze" : null;

/** Count left after "mark all read" (base = count at that moment). */
export const missedCount = (count: number, base = 0): number => (count > base ? count - base : 0);

/** Keeps a read base from exceeding the live count (items read elsewhere), so
 *  later new items are not swallowed. Returns the same object when unchanged. */
export function reconcileRead(read: Record<string, number>, counts: Badges): Record<string, number> {
  let out = read;
  for (const id of Object.keys(read)) {
    if (!(id in counts)) continue; // no fresh count yet (startup): keep the base
    const c = counts[id];
    if (read[id] > c) { if (out === read) out = { ...read }; if (c > 0) out[id] = c; else delete out[id]; }
  }
  return out;
}
export const markAllRead = (p: NotifPrefs, counts: Badges): NotifPrefs => {
  const read: Record<string, number> = {};
  for (const id of Object.keys(counts)) if (counts[id] > 0) read[id] = counts[id];
  return { ...p, read };
};

export type HubRow = { id: string; count: number; mute: "dnd" | "snooze" | null };
/** Hub list: every module with unread items, biggest first (ties by id); muted ones stay listed. */
export function groupMissed(counts: Badges, p: NotifPrefs, nowMs: number): HubRow[] {
  return Object.keys(counts)
    .map((id) => ({ id, count: missedCount(counts[id], p.read[id]), mute: muteKind(p, id, nowMs) }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/** What moons, the sun glow and the title-bar pill show: read items removed,
 *  snoozed/DND modules and quiet hours muted. The log and hub are unaffected. */
export function shownCounts(counts: Badges, p: NotifPrefs, now: Date): Badges {
  const out: Badges = {};
  if (inQuiet(p.quiet, minutesOfDay(now))) return out;
  const ms = now.getTime();
  for (const id of Object.keys(counts)) {
    const c = muteKind(p, id, ms) ? 0 : missedCount(counts[id], p.read[id]);
    if (c > 0) out[id] = c;
  }
  return out;
}
export const totalOf = (b: Badges): number => Object.values(b).reduce((t, n) => t + (n > 0 ? n : 0), 0);

/** Ms until shownCounts could change by itself (a snooze ends or quiet hours start/stop), or null. */
export function nextChangeMs(p: NotifPrefs, now: Date): number | null {
  const ms = now.getTime();
  let best: number | null = null;
  const take = (v: number) => { if (v > 0 && (best === null || v < best)) best = v; };
  for (const until of Object.values(p.snooze)) take(until - ms);
  if (p.quiet.on && p.quiet.start !== p.quiet.end) {
    const m = minutesOfDay(now) + (now.getSeconds() * 1000 + now.getMilliseconds()) / 60000;
    for (const edge of [p.quiet.start, p.quiet.end]) take((((edge - m) % DAY) + DAY) % DAY * 60000 || DAY * 60000);
  }
  return best;
}

/** Ids whose count changed between two snapshots (absent = 0): rows for notif_log. */
export function diffCounts(prev: Badges, next: Badges): { id: string; count: number }[] {
  const out: { id: string; count: number }[] = [];
  for (const id of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    const a = prev[id] ?? 0, b = next[id] ?? 0;
    if (a !== b) out.push({ id, count: b });
  }
  return out;
}
