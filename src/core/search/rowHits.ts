// Pure: turn a module's load() rows into search hits by picking one title-like
// field, so modules without their own `search` are still findable. Only short
// labels are used (never `body` past the first line, never secret-ish fields).
import type { SearchHit } from "../module.ts";

const TITLE_KEYS = ["title", "name", "subject", "full_name", "symbol", "label", "location", "host", "body", "text", "url"];
const SUB_KEYS = ["source", "sender", "from", "feed", "category", "tags", "description"];
const MAX = 120;

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const firstLine = (s: string) => s.split(/\r?\n/, 1)[0].trim().slice(0, MAX);

export function rowTitle(row: Record<string, unknown>): string {
  for (const k of TITLE_KEYS) {
    const v = firstLine(str(row[k]));
    if (v) return v;
  }
  return "";
}

export function rowsToHits(rows: Record<string, unknown>[], limit = 500): SearchHit[] {
  const out: SearchHit[] = [];
  for (const r of rows.slice(0, limit)) {
    const title = rowTitle(r);
    if (!title) continue;
    const sub = SUB_KEYS.map((k) => firstLine(str(r[k]))).find(Boolean);
    const id = str(r.id) || undefined;
    out.push({ title, ...(sub ? { subtitle: sub } : {}), ...(id ? { id } : {}) });
  }
  return out;
}
