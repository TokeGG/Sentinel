// Quote refresh: Stooq (stocks/ETFs) + CoinGecko (crypto); price alerts are checked after each refresh.
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { checkAlerts } from "./extraStore";
import type { WatchRow } from "./rows";

// Both free, no API key, no account:
// - Stooq: plain CSV quotes for stocks/ETFs.
// - CoinGecko: public simple-price endpoint for crypto.
const STOOQ_URL = "https://stooq.com/q/l/";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

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

export async function refreshQuotes() {
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

  const fired = await checkAlerts();
  await logActivity(
    "finance",
    "refresh_quotes",
    `checked ${rows.length} symbol(s)`,
    `${updated} updated${failed ? `, ${failed} failed` : ""}`
  );
  return { ok: true, updated, failed, fired };
}

