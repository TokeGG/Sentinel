// Main-window runtime: the prefs and the "shown" counts (what moons, the sun
// glow and the title-bar pill display). Recomputed on badge/prefs changes and
// by ONE timeout aimed at the next snooze end or quiet-hours edge: UI state
// only, it starts no work. The notif_log and the hub are never muted.
import { getBadges, subscribeBadges } from "./badgeStore";
import type { Badges } from "./badges";
import { DEFAULT_PREFS, nextChangeMs, shownCounts, type NotifPrefs } from "./notifLogic";

let prefs: NotifPrefs = DEFAULT_PREFS, shown: Badges = {}, timer = 0, started = false;
const subs = new Set<() => void>();

export const getShown = (): Badges => shown;
export const getPrefs = (): NotifPrefs => prefs;
export function subscribeShown(f: () => void): () => void {
  subs.add(f);
  return () => void subs.delete(f);
}
const same = (a: Badges, b: Badges) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

export function recompute() {
  const now = new Date(), next = shownCounts(getBadges(), prefs, now);
  window.clearTimeout(timer);
  const wait = nextChangeMs(prefs, now);
  if (wait !== null) timer = window.setTimeout(recompute, Math.min(wait + 500, 86400_000));
  if (same(next, shown)) return;
  shown = next;
  subs.forEach((f) => f());
}
export function setPrefs(p: NotifPrefs) {
  prefs = p;
  recompute();
}
/** Idempotent: follow the raw badge store. */
export function startNotifStore() {
  if (started) return;
  started = true;
  subscribeBadges(recompute);
  recompute();
}
