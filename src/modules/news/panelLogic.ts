// Pure helpers shared by the News and Deals panels (and Notes for dates).
import { ago, utcDate } from "../../ui/kit/format.ts";

type Row = Record<string, unknown>;

/** Section declarations shared by News/Deals; FeedPanel renders exactly these ids. */
export function feedSections(listId: string, listLabel: string) {
  return [
    { id: "add", label: "Add feed" },
    { id: "filters", label: "Source filters" },
    { id: listId, label: listLabel },
    { id: "status", label: "Fetch & auto-refresh" },
  ];
}

function host(u: unknown): string | null {
  if (typeof u !== "string" || !u.trim()) return null;
  try {
    return new URL(u.trim()).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Display name of a row's source. Rows carry `label` (often NULL: addSource
 * only stores the url), `source_url` (the feed) and `link` (the item). */
export function sourceLabel(r: Row): string {
  if (typeof r.label === "string" && r.label.trim()) return r.label.trim();
  const fromHost = host(r.source_url) ?? host(r.link);
  if (fromHost) return fromHost;
  return typeof r.source_url === "string" ? r.source_url.trim() : "";
}

/** Unique non-blank source labels, sorted. */
export function sourcesOf(rows: Row[]): string[] {
  return [...new Set(rows.map(sourceLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** Rows from `source` (by display label); null = all rows. */
export function filterBySource<T extends Row>(rows: T[], source: string | null): T[] {
  return source === null ? rows : rows.filter((r) => sourceLabel(r) === source);
}

/** Age text for a row: published_at, else fetched_at/created_at; "" if unknown. */
export function rowAge(r: Row): string {
  const s = [r.published_at, r.fetched_at, r.created_at].find((v) => typeof v === "string" && v);
  return typeof s === "string" ? ago(utcDate(s)) : "";
}

export type FeedSource = { id: number; url: string; label: string | null };

/** Dropdown text for a stored feed: its label, else the host of its url. */
export function feedChoiceLabel(s: FeedSource): string {
  return s.label?.trim() || host(s.url) || s.url;
}
