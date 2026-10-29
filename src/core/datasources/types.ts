// Built-in reference data sources per panel-bot category. Each source is a URL builder plus a PURE parser
// (tested against hand-written fixtures). None has been run against the live API: field names are unverified.
import type { Category } from "../categories.ts";

export interface DsRow { title: string; detail?: string; url?: string }
export interface DsRequest { url: string; method?: "GET" | "POST"; body?: string }
export interface DataSource {
  id: string;
  category: Category;
  name: string;
  about: string;
  /** Example query used by the Settings "Test" button. */
  sample: string;
  request(q: string): DsRequest;
  /** Pure: response text (+ the query, for sources that filter a whole list locally) -> rows. Throws on garbage. */
  parse(text: string, q: string): DsRow[];
  keyOptional?: boolean;
}

export const enc = encodeURIComponent;
export const json = (t: string): unknown => JSON.parse(t);
export const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const has = (hay: string, q: string) => !q.trim() || hay.toLowerCase().includes(q.trim().toLowerCase());
export const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
export const MAX_ROWS = 10;
export const cap = (rows: DsRow[]) => rows.filter((r) => r.title).slice(0, MAX_ROWS);
/** MediaWiki opensearch shape: [query, [titles], [descriptions], [urls]]. */
export const openSearch = (t: string): DsRow[] => {
  const a = arr(json(t));
  const titles = arr(a[1]), desc = arr(a[2]), urls = arr(a[3]);
  return cap(titles.map((x, i) => ({ title: str(x), detail: str(desc[i]) || undefined, url: str(urls[i]) || undefined })));
};
