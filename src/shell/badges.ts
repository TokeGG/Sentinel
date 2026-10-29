// Pure badge helpers (no Tauri, no DOM): count sanitizing, the refresh of every
// module's badge() and the planet-badge payload check. The store is badgeStore.ts.
// Refresh is event-driven only (mount, window focus, panel close): no interval.
import type { ModuleManifest } from "../core/module.ts";

export type Badges = Record<string, number>;
/** Tauri event `{ id, count }` (web panels, e.g. Discord's title count). */
export const PLANET_BADGE = "planet-badge";
export const BADGE_TIMEOUT_MS = 3000;
export const BADGE_MAX = 999;
const ID_MAX = 64;

const okId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= ID_MAX && !(id in Object.prototype) && id !== "prototype";

const clean = (n: unknown): number =>
  typeof n === "number" && Number.isInteger(n) && n > 0 ? Math.min(n, BADGE_MAX) : 0;

/** New map with `id` set to a sanitized count (junk becomes 0, cap 999); bad ids are ignored. */
export function mergeBadge(b: Badges, id: string, count: number): Badges {
  return okId(id) ? { ...b, [id]: clean(count) } : { ...b };
}

export const totalBadges = (b: Badges): number => {
  let t = 0;
  for (const k in b) t += clean(b[k]);
  return t;
};

/** Validated `planet-badge` payload, or null. `knownIds` = registered module ids. */
export function parsePlanetBadge(payload: unknown, knownIds: readonly string[]): { id: string; count: number } | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const { id, count } = payload as { id?: unknown; count?: unknown };
  if (!okId(id) || !knownIds.includes(id) || typeof count !== "number") return null;
  return { id, count };
}

/** Race `p` against a one-shot timer (cleared as soon as either side wins). */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((res) => { t = setTimeout(() => res(fallback), ms); });
  return Promise.race([p.catch(() => fallback), timeout]).finally(() => clearTimeout(t));
}

/** Calls every module's badge() once, in parallel. A throwing or hanging badge()
 *  (3 s) yields 0 for that module only; modules without badge() are absent. */
export async function refreshBadges(registry: ModuleManifest[], timeoutMs = BADGE_TIMEOUT_MS): Promise<Badges> {
  const withBadge = registry.filter((m) => typeof m.badge === "function");
  const counts = await Promise.all(
    withBadge.map((m) => withTimeout(Promise.resolve().then(() => m.badge!()), timeoutMs, 0))
  );
  let out: Badges = {};
  withBadge.forEach((m, i) => { out = mergeBadge(out, m.id, counts[i]); });
  return out;
}
