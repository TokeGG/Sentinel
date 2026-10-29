// Pure daily briefing: titles and counts only. Inputs are generic load() rows
// grouped by module id, so the briefing never needs module-specific code paths
// beyond picking which ids to show.
import { rowTitle } from "../../core/search/rowHits.ts";

export type Section = { id: string; name: string; lines: string[]; count: number };
const DAY = 86_400_000;

const dateOf = (r: Record<string, unknown>): number | null => {
  for (const k of ["start", "starts_at", "due", "date", "at"]) {
    const v = r[k];
    const t = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : typeof v === "string" ? Date.parse(v) : NaN;
    if (Number.isFinite(t)) return t;
  }
  return null;
};

/** Rows dated within today (local midnight..+24h) - for calendars/tasks. */
export function todayRows(rows: Record<string, unknown>[], now: Date): Record<string, unknown>[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return rows.filter((r) => { const t = dateOf(r); return t !== null && t >= start && t < start + DAY; });
}
/** Rows the user liked (taste/signal fields). */
export const likedRows = (rows: Record<string, unknown>[]) =>
  rows.filter((r) => r.liked === true || r.liked === 1 || r.signal === "like" || r.vote === 1);

/** Biggest movers by |change|% (finance-like rows: change_pct / changePercent / change). */
export function movers(rows: Record<string, unknown>[], n = 3): string[] {
  const pct = (r: Record<string, unknown>) => Number(r.change_pct ?? r.changePercent ?? r.change ?? NaN);
  return rows.filter((r) => Number.isFinite(pct(r)))
    .sort((a, b) => Math.abs(pct(b)) - Math.abs(pct(a))).slice(0, n)
    .map((r) => `${rowTitle(r)} ${pct(r) >= 0 ? "+" : ""}${pct(r).toFixed(2)}%`);
}

export function section(id: string, name: string, rows: Record<string, unknown>[], max = 5): Section {
  const lines = rows.map(rowTitle).filter(Boolean);
  return { id, name, lines: lines.slice(0, max), count: lines.length };
}

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
