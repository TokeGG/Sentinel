// Pure extra notification rules (app_settings `notif_policy` JSON). Counts and
// module ids only; priority matching takes a sender/subject a module already
// has and returns a boolean, nothing is stored or logged.
export type Tone = "off" | "chime" | "blip" | "bell" | "low";
export type NotifPolicy = {
  sounds: Record<string, Tone>; // per module
  prioritySenders: string[]; priorityWords: string[];
  digest: { on: boolean; at: number }; // minutes since midnight; toasts batched into one a day
  lockCountOnly: boolean; // toast text never names a module
  hourlyLimit: number; // 0 = unlimited toasts per hour
  vacationUntil: number; // epoch ms; 0 = off
  focus: { until: number; allow: string[] }; // focus session: only these modules alert
};
export const DEFAULT_POLICY: NotifPolicy = {
  sounds: {}, prioritySenders: [], priorityWords: [], digest: { on: false, at: 18 * 60 },
  lockCountOnly: true, hourlyLimit: 0, vacationUntil: 0, focus: { until: 0, allow: [] },
};
const TONES: Tone[] = ["off", "chime", "blip", "bell", "low"];
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.floor(v) : d);
const strs = (v: unknown, max = 50): string[] => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, max) : [];
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function sanitizePolicy(raw: unknown): NotifPolicy {
  const r = obj(raw), d = obj(r.digest), f = obj(r.focus);
  const sounds: Record<string, Tone> = {};
  for (const [k, v] of Object.entries(obj(r.sounds))) if (/^[\w.\-]{1,64}$/.test(k) && TONES.includes(v as Tone)) sounds[k] = v as Tone;
  return {
    sounds, prioritySenders: strs(r.prioritySenders), priorityWords: strs(r.priorityWords),
    digest: { on: d.on === true, at: num(d.at, 0, 1439, DEFAULT_POLICY.digest.at) },
    lockCountOnly: r.lockCountOnly !== false, hourlyLimit: num(r.hourlyLimit, 0, 100, 0),
    vacationUntil: num(r.vacationUntil, 0, 8.64e15, 0),
    focus: { until: num(f.until, 0, 8.64e15, 0), allow: strs(f.allow).filter((x) => /^[\w.\-]{1,64}$/.test(x)) },
  };
}
export const splitList = (s: string): string[] => strs(s.split(/[,\n]/));

/** For modules that have a sender/subject (e.g. email): is it priority? */
export function isPriority(p: NotifPolicy, sender: string, subject: string): boolean {
  const s = sender.toLowerCase(), t = subject.toLowerCase();
  return p.prioritySenders.some((x) => s.includes(x)) || p.priorityWords.some((w) => t.includes(w) || s.includes(w));
}

export type AlertDecision = "toast" | "digest" | "drop";
/** Should a new-count event for `ids` alert now? `sentThisHour` = toasts in the last hour. */
export function decideAlert(p: NotifPolicy, ids: string[], nowMs: number, sentThisHour: number, priority = false): AlertDecision {
  if (p.vacationUntil > nowMs && !priority) return "drop";
  if (p.focus.until > nowMs && !priority && !ids.some((id) => p.focus.allow.includes(id.toLowerCase()))) return "drop";
  if (p.digest.on && !priority) return "digest";
  if (p.hourlyLimit > 0 && sentThisHour >= p.hourlyLimit && !priority) return "drop";
  return "toast";
}
/** Is the digest due: past today's digest time and not yet sent today? */
export function digestDue(p: NotifPolicy, now: Date, lastSentMs: number): boolean {
  if (!p.digest.on) return false;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(p.digest.at / 60), p.digest.at % 60).getTime();
  return now.getTime() >= at && lastSentMs < at;
}
export function toastText(p: NotifPolicy, n: number, total: number, names: string[]): string {
  const base = `${n} new notification${n === 1 ? "" : "s"} (${total} unread)`;
  return p.lockCountOnly || !names.length ? base : `${base}: ${names.slice(0, 3).join(", ")}`;
}
/** Badge colour by urgency: count thresholds -> token name. */
export function urgencyColor(count: number, priority = false): string {
  if (priority || count >= 20) return "var(--bad)";
  if (count >= 5) return "var(--warn)";
  return "var(--accent)";
}
/** Drop toast timestamps older than an hour. */
export const pruneHour = (sent: number[], nowMs: number): number[] => sent.filter((t) => nowMs - t < 3600_000);

/** WebAudio tone recipe (no sound files): [frequency Hz, duration s][]. */
export const TONE_NOTES: Record<Exclude<Tone, "off">, [number, number][]> = {
  chime: [[880, 0.12], [1320, 0.18]], blip: [[1200, 0.06]], bell: [[660, 0.3]], low: [[330, 0.2], [262, 0.25]],
};
