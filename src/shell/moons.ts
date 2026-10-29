// Pure notification-moon math. Moons are offsets from the planet's center.
import { hashId } from "./hue.ts";

export const MOON_MAX = 5;
export const BUBBLE_ABOVE = 5; // a number bubble shows when count > 5
const TAU = Math.PI * 2;
const RATE = 0.8; // rad per orbit-second
const CAP = 999;

export const moonCount = (count: number): number =>
  Number.isFinite(count) && count > 0 ? Math.min(Math.floor(count), MOON_MAX) : 0;

/** Writes up to min(moonCount(count), out.length) offsets into `out`; returns how many.
 *  Phase comes from the id; a bad radius or time degrades to 0, never NaN. */
export function moonPositionsInto(out: { x: number; y: number }[], count: number, radius: number, tSec: number, id: string): number {
  const n = Math.min(moonCount(count), out.length);
  const r = Number.isFinite(radius) && radius > 0 ? radius : 0;
  const t = Number.isFinite(tSec) ? tSec : 0;
  const base = (hashId(id) / 4294967296) * TAU + t * RATE;
  for (let k = 0; k < n; k++) {
    const a = base + (k * TAU) / n;
    out[k].x = r * Math.cos(a) + 0; // + 0 turns -0 into 0
    out[k].y = r * Math.sin(a) + 0;
  }
  return n;
}

export function moonPositions(count: number, radius: number, tSec: number, id: string): { x: number; y: number }[] {
  const out = Array.from({ length: moonCount(count) }, () => ({ x: 0, y: 0 }));
  moonPositionsInto(out, count, radius, tSec, id);
  return out;
}

const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), CAP) : 0);
const BUBBLE: string[] = [];
const UNREAD = new Map<number, string>();

/** "" for 0, the number up to 99, "99+" above. Cached: no per-frame formatting. */
export function badgeText(count: number): string {
  const n = clamp(count);
  if (n === 0) return "";
  if (n > 99) return "99+";
  return (BUBBLE[n] ??= String(n));
}

/** Hover text "N unread" ("" for 0), cached per count. */
export function unreadText(count: number): string {
  const n = clamp(count);
  if (n === 0) return "";
  let s = UNREAD.get(n);
  if (s === undefined) UNREAD.set(n, (s = `${n} unread`));
  return s;
}
