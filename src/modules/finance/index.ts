import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { financeSections } from "./panelLogic";
import { toTradeRow, toWatchRow, type TradeRow, type WatchRow } from "./rows";

// Both free, no API key, no account:
// - Stooq: plain CSV quotes for stocks/ETFs.
// - CoinGecko: public simple-price endpoint for crypto.
const STOOQ_URL = "https://stooq.com/q/l/";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

// Public STOCK Act disclosure datasets, free, no key — the same data
// senatestockwatcher.com / housestockwatcher.com publish. Field names below
// are defensive (several possible keys tried) since the upstream schema
// isn't pinned to a version; verify against a live fetch and adjust if a
// field comes back empty.
const SENATE_TRADES_URL =
  "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json";
const HOUSE_TRADES_URL =
  "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json";

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

async function syncCongressTrades() {
  const d = await getDb();
  let inserted = 0;

  const sources: { url: string; chamber: "senate" | "house" }[] = [
    { url: SENATE_TRADES_URL, chamber: "senate" },
    { url: HOUSE_TRADES_URL, chamber: "house" },
  ];

  for (const { url, chamber } of sources) {
    try {
      const res = await fetch(url);
      const data = (await res.json()) as Record<string, unknown>[];
      // Most recent first, capped — this is a large public dataset and we
      // only need the recent window for a watchlist-style view.
      for (const t of data.slice(-500)) {
        const politician = pick(t, ["senator", "representative", "politician", "name"]);
        const ticker = pick(t, ["ticker", "symbol"]);
        const transactionType = pick(t, ["type", "transaction_type"]);
        const tradeDate = pick(t, ["transaction_date", "trade_date", "date"]);
        const amountRange = pick(t, ["amount", "amount_range"]);
        if (!politician) continue;

        const result = await d.execute(
          `INSERT OR IGNORE INTO congress_trades
             (chamber, politician, ticker, transaction_type, trade_date, amount_range)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [chamber, politician, ticker, transactionType, tradeDate, amountRange]
        );
        if (result.rowsAffected > 0) inserted++;
      }
    } catch {
      // one chamber's feed failing shouldn't block the other
    }
  }

  await logActivity("finance", "sync_congress_trades", "Senate + House disclosures", `${inserted} new`);
  return { ok: true, inserted };
}

async function addSymbol(args?: Record<string, unknown>) {
  const raw = String(args?.symbol ?? "").trim();
  if (!raw) throw new Error("symbol is empty");
  // "AAPL" or "AAPL:stock" or "bitcoin:crypto" — default to stock.
  const [symbol, kind] = raw.includes(":") ? raw.split(":") : [raw, "stock"];
  if (kind !== "stock" && kind !== "crypto") {
    throw new Error('kind must be "stock" or "crypto" (e.g. "bitcoin:crypto")');
  }
  const d = await getDb();
  await d.execute("INSERT OR IGNORE INTO watchlist (symbol, kind) VALUES ($1, $2)", [
    symbol.toLowerCase(),
    kind,
  ]);
  return { ok: true };
}

async function fetchStockQuote(symbol: string): Promise<number | null> {
  const res = await fetch(`${STOOQ_URL}?s=${encodeURIComponent(symbol)}.us&f=sd2t2ohlcv&h&e=csv`);
  const csv = await res.text();
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return null;
  const cols = lines[1].split(",");
  const close = Number(cols[6]); // Symbol,Date,Time,Open,High,Low,Close,Volume
  return Number.isFinite(close) ? close : null;
}

async function fetchCryptoQuote(id: string): Promise<number | null> {
  const res = await fetch(`${COINGECKO_URL}?ids=${encodeURIComponent(id)}&vs_currencies=usd`);
  const data = (await res.json()) as Record<string, { usd?: number }>;
  return data[id]?.usd ?? null;
}

async function refreshQuotes() {
  const d = await getDb();
  const rows = await d.select<WatchRow[]>("SELECT * FROM watchlist");

  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const price =
        row.kind === "crypto" ? await fetchCryptoQuote(row.symbol) : await fetchStockQuote(row.symbol);
      if (price != null) {
        await d.execute(
          "UPDATE watchlist SET last_price = $1, last_checked = datetime('now') WHERE id = $2",
          [price, row.id]
        );
        updated++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  await logActivity(
    "finance",
    "refresh_quotes",
    `checked ${rows.length} symbol(s)`,
    `${updated} updated${failed ? `, ${failed} failed` : ""}`
  );
  return { ok: true, updated, failed };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const watched = await d.select<WatchRow[]>("SELECT * FROM watchlist ORDER BY symbol ASC");
  const watchRows = watched.map(toWatchRow);

  // Trades on tickers you're watching surface first; otherwise just the
  // most recent disclosures overall, capped so the panel stays readable.
  const tickers = watched.filter((w) => w.kind === "stock").map((w) => w.symbol.toUpperCase());
  const trades =
    tickers.length > 0
      ? await d.select<TradeRow[]>(
          `SELECT * FROM congress_trades WHERE ticker IN (${tickers.map((_, i) => `$${i + 1}`).join(",")})
           ORDER BY trade_date DESC LIMIT 30`,
          tickers
        )
      : await d.select<TradeRow[]>(
          "SELECT * FROM congress_trades ORDER BY trade_date DESC LIMIT 30"
        );

  const tradeRows = trades.map(toTradeRow);

  return [...watchRows, ...tradeRows];
}

export const financeModule: ModuleManifest = {
  id: "hub.finance",
  name: "Finance",
  accent: "#e6c04f",
  ring: "daily",
  icon: "finance",
  description:
    "Stock/ETF (Stooq) and crypto (CoinGecko) watchlist, plus Senate/House trade disclosures. All free, no key, no account linking.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: financeSections },
  skills: [
    { name: "add_symbol", run: addSymbol },
    { name: "refresh_quotes", run: refreshQuotes },
    { name: "sync_congress_trades", run: syncCongressTrades },
  ],
  load: loadRows,
  quickAdd: {
    skill: "add_symbol",
    argName: "symbol",
    placeholder: 'Add a symbol (e.g. "AAPL" or "bitcoin:crypto")…',
  },
  actions: [
    { label: "Refresh quotes", skill: "refresh_quotes" },
    { label: "Sync Congress Trades", skill: "sync_congress_trades" },
  ],
  schedule: { skill: "refresh_quotes", intervalMinutes: 60 },
};

registerModule(financeModule);
