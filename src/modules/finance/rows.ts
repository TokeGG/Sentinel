// DB row shapes and the pure mappers from them to panel rows (no Tauri/DB).
export interface WatchRow extends Record<string, unknown> {
  id: number;
  symbol: string;
  kind: "stock" | "crypto";
  last_price: number | null;
  last_checked: string | null;
}

export interface TradeRow extends Record<string, unknown> {
  id: number;
  chamber: "senate" | "house";
  politician: string;
  ticker: string | null;
  transaction_type: string | null;
  trade_date: string | null;
  amount_range: string | null;
}

// title/label keep the generic list working; the other fields feed the panel.
export function toWatchRow(r: WatchRow, st: { change?: number | null; pct?: number | null; at?: string | null; source?: string; error?: string } = {}): Record<string, unknown> {
  return {
    id: `w-${r.id}`,
    title: `${r.symbol.toUpperCase()} (${r.kind}): ${r.last_price != null ? `$${r.last_price.toFixed(2)}` : "—"}`,
    kind: "watch",
    dbId: r.id,
    symbol: r.symbol,
    asset: r.kind,
    group: typeof r.grp === "string" ? r.grp : "",
    price: r.last_price,
    last_checked: r.last_checked,
    change: st.change ?? null,
    pct: st.pct ?? null,
    quote_at: st.at ?? null,
    source: st.source ?? null,
    quote_error: st.error ?? null,
  };
}

export function toTradeRow(t: TradeRow): Record<string, unknown> {
  return {
    id: `t-${t.id}`,
    title: `${t.politician} (${t.chamber}) ${t.transaction_type ?? "traded"} ${t.ticker ?? "?"}${t.amount_range ? ` — ${t.amount_range}` : ""}`,
    label: t.trade_date ?? undefined,
    kind: "trade",
    politician: t.politician,
    chamber: t.chamber,
    ticker: t.ticker,
    transaction_type: t.transaction_type,
    amount_range: t.amount_range,
    date: t.trade_date,
  };
}
