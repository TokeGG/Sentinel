// Pure: curated source catalogs (News, Deals) — idempotent seeding, per-source check status, list filtering.
// State lives as JSON in app_settings `src_state:<kind>` (no migration): { [url]: SrcState }.
import { parseFeed } from "../rss.ts";

export interface CatalogEntry { url: string; label: string; category: string }
export type SrcStatus = "unverified" | "working" | "broken";
export interface SrcState { status?: SrcStatus; at?: string; err?: string; off?: boolean; removed?: boolean }
export type StateMap = Record<string, SrcState>;

export function parseState(raw: string | null | undefined): StateMap {
  try {
    const v = JSON.parse(raw ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as StateMap) : {};
  } catch {
    return {};
  }
}

/** Catalog entries to insert: not already a source, never removed by the user, url not repeated. */
export function seedPlan(catalog: CatalogEntry[], existing: Iterable<string>, state: StateMap): CatalogEntry[] {
  const have = new Set(existing);
  return catalog.filter((c) => {
    if (have.has(c.url) || state[c.url]?.removed) return false;
    have.add(c.url);
    return true;
  });
}

/** Feed check verdict from an HTTP status and body: working = 2xx with at least one item. */
export function checkVerdict(status: number, body: string): { status: SrcStatus; err?: string } {
  if (status < 200 || status > 299) return { status: "broken", err: `HTTP ${status}` };
  const n = parseFeed(body).length;
  if (n > 0) return { status: "working" };
  return { status: "broken", err: /<html[\s>]/i.test(body.slice(0, 2000)) ? "HTML page, not a feed" : "no feed items" };
}

export interface SrcRow { id: number; url: string; label: string | null; category: string; enabled: boolean; status: SrcStatus; err: string }

export function mergeRows(sources: { id: number; url: string; label: string | null; category?: string | null; enabled?: number | boolean }[], state: StateMap): SrcRow[] {
  return sources.map((s) => {
    const st = state[s.url] ?? {};
    return {
      id: s.id, url: s.url, label: s.label, category: s.category || "other",
      enabled: s.enabled === undefined ? !st.off : !!s.enabled && !st.off,
      status: st.status ?? "unverified", err: st.err ?? "",
    };
  });
}

export function filterRows(rows: SrcRow[], category: string | null, status: SrcStatus | null): SrcRow[] {
  return rows.filter((r) => (!category || r.category === category) && (!status || r.status === status));
}

export const countBy = (rows: SrcRow[], status: SrcStatus) => rows.filter((r) => r.status === status).length;

/** Runs `fn` over items with at most `n` in flight. */
export async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => { while (i < items.length) await fn(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}
