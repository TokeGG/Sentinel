// Pure display helpers for the UI kit (no React/Tauri) — unit-tested.

function toTime(d: Date | string | null | undefined): number | null {
  if (d == null) return null;
  const t = (d instanceof Date ? d : new Date(d)).getTime();
  return Number.isFinite(t) ? t : null;
}

const SQL_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
/** SQLite datetime('now') is UTC without a zone; mark it so Date reads it as UTC. */
export function utcDate(s: string): Date {
  return new Date(SQL_TIME.test(s) ? s.replace(" ", "T") + "Z" : s);
}

/** Compact relative age: "just now", "5m", "3h", "2d"; "" for an invalid date. */
export function ago(date: Date | string, now: Date = new Date()): string {
  const t = toTime(date);
  if (t === null) return "";
  const s = Math.floor((now.getTime() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** value/max as a percentage clamped to 0–100; 0 for invalid input. */
export function pct(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

/** Gauge tone: warn from warnAt (default 75% of max); bad from max(90% of max, warnAt). */
export function gaugeTone(value: number, max = 100, warnAt?: number): "ok" | "warn" | "bad" {
  const warn = warnAt ?? max * 0.75;
  if (value >= Math.max(max * 0.9, warn)) return "bad";
  return value >= warn ? "warn" : "ok";
}

const r = (n: number) => Math.round(n * 100) / 100;

/** SVG polyline points inside a w×h box (max at top). Flat/one-point → mid line. */
export function sparkPoints(points: number[], w: number, h: number): string {
  const vals = points.filter((p) => Number.isFinite(p));
  if (vals.length === 0) return "";
  const series = vals.length === 1 ? [vals[0], vals[0]] : vals;
  const lo = Math.min(...series);
  const span = Math.max(...series) - lo;
  const step = w / (series.length - 1);
  return series
    .map((v, i) => `${r(i * step)},${r(span === 0 ? h / 2 : h - ((v - lo) / span) * h)}`)
    .join(" ");
}

/** Status line text: error wins, else "Updated X ago · Auto-refresh Y". */
export function statusText(
  updated: Date | string | null | undefined,
  autoRefresh: string | null | undefined,
  error: string | null | undefined,
  now: Date = new Date(),
): string {
  if (error) return `Error: ${error}`;
  const t = toTime(updated);
  const age = t === null ? "" : ago(new Date(t), now);
  const left = age === "" ? "Not updated yet" : age === "just now" ? "Updated just now" : `Updated ${age} ago`;
  return `${left} · Auto-refresh ${autoRefresh || "off"}`;
}

const HEX6 = /^#[0-9a-f]{6}$/i;
// Must match --on-accent-dark / --on-accent-light in tokens.css.
const DARK_TEXT = "#0a0f1f";
const LIGHT_TEXT = "#ffffff";

function luminance(hex: string): number {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Which label color reads better on the accent; invalid hex -> "light". */
export function onAccent(hex: string): "dark" | "light" {
  if (typeof hex !== "string" || !HEX6.test(hex)) return "light";
  return contrast(hex, DARK_TEXT) > contrast(hex, LIGHT_TEXT) ? "dark" : "light";
}

const NUM = /^\d{1,3}(\.\d{1,4})?$/;
const NUM_KEYS = ["--density", "--font-scale", "--tint"];

/** Allowlist of per-panel CSS vars: hex accent, plain finite numbers only. */
export function safeVars(vars: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const v = vars ?? {};
  const a = v["--accent"];
  if (typeof a === "string" && HEX6.test(a)) out["--accent"] = a;
  for (const k of NUM_KEYS) {
    const n = v[k];
    if (typeof n === "string" && NUM.test(n) && Number.isFinite(Number(n))) out[k] = n;
  }
  return out;
}

const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"];
/** "0 B", "1.5 MB": bytes with one decimal above B; rounds up across unit edges. */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  let v = bytes;
  let u = 0;
  while (u < SIZE_UNITS.length - 1 && (u === 0 ? v >= 1024 : Math.round(v * 10) / 10 >= 1024)) {
    v /= 1024;
    u++;
  }
  return u === 0 ? `${Math.round(v)} B` : `${v.toFixed(1)} ${SIZE_UNITS[u]}`;
}
