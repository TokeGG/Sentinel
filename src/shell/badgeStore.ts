// Tiny module-level badge store (main window): counts per planet id plus the
// time each count last went UP, which drives the moon pulse. Web-panel counts
// (planet-badge events) live only here, in memory.
import { mergeBadge, type Badges } from "./badges.ts";

let badges: Badges = {};
let seeded = false; // the first refresh after startup does not pulse
const pulse = new Map<string, number>();
const subs = new Set<() => void>();

export const getBadges = (): Badges => badges;
export const getPulseStart = (id: string): number => pulse.get(id) ?? 0;
export function subscribeBadges(f: () => void): () => void {
  subs.add(f);
  return () => void subs.delete(f);
}
export function resetBadges() {
  badges = {};
  seeded = false;
  pulse.clear();
}

/** Set one id's count; a rise starts its pulse at `now`. Notifies on change only. */
export function setBadge(id: string, count: number, now = performance.now(), allowPulse = true) {
  const next = mergeBadge(badges, id, count);
  const was = badges[id] ?? 0, is = next[id];
  if (is === undefined || (is === was && id in badges)) return;
  if (allowPulse && is > was) pulse.set(id, now);
  badges = next;
  subs.forEach((f) => f());
}

/** Result of refreshBadges: ids it did not return (web panels) keep their counts. */
export function applyRefresh(r: Badges, now = performance.now()) {
  for (const id of Object.keys(r)) setBadge(id, r[id], now, seeded);
  seeded = true;
}
