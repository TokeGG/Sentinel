// Pure: what a watchlist tile shows for change and freshness (no Tauri/React).
type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Provider day change (vs previous close) wins over the session-built figure. */
export function dayChange(r: Row, session: { pct: number | null; caption: string }): { pct: number | null; abs: number | null; caption: string } {
  const pct = n(r.pct);
  if (pct !== null) return { pct, abs: n(r.change), caption: r.asset === "crypto" ? "24h" : "today" };
  return { pct: session.pct, abs: null, caption: session.caption };
}

/** "Updated 14:32 · Stooq" from the quote time (else our check time); "" if none. */
export function updatedText(r: Row): string {
  const raw = (typeof r.quote_at === "string" && r.quote_at) || (typeof r.last_checked === "string" && r.last_checked) || "";
  if (!raw) return "";
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(raw) || r.quote_at ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const t = d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return `Updated ${t}${typeof r.source === "string" && r.source ? ` · ${r.source}` : ""}`;
}

export const absText = (v: number | null) => (v === null ? "" : `${v >= 0 ? "+" : "−"}${Math.abs(v) >= 1 ? Math.abs(v).toFixed(2) : Math.abs(v).toPrecision(3)}`);
