// Request rules for Advent of Code, pure: each page/input is fetched at most once (then the cache answers), and
// requests are spaced at least MIN_GAP_MS apart.
export const MIN_GAP_MS = 15_000;
export type FetchKind = "page" | "input";
export interface Cached { statement?: string | null; input?: string | null }

export type FetchPlan = { kind: "cached" } | { kind: "wait"; ms: number } | { kind: "fetch" };
export function fetchPlan(what: FetchKind, cached: Cached | null, lastFetchMs: number | null, now: number, gap = MIN_GAP_MS): FetchPlan {
  const have = what === "page" ? cached?.statement : cached?.input;
  if (have) return { kind: "cached" };
  if (lastFetchMs !== null && now - lastFetchMs < gap) return { kind: "wait", ms: gap - (now - lastFetchMs) };
  return { kind: "fetch" };
}

/** Session cookie as pasted ("session=abc..." or just the value): hex only, else null. */
export function cleanCookie(raw: string): string | null {
  const v = raw.trim().replace(/^session=/i, "").replace(/;.*$/, "").trim();
  return /^[0-9a-f]{32,256}$/i.test(v) ? v : null;
}
