// Quote refresh: Stooq (stocks/ETFs) + CoinGecko (crypto); price alerts are checked after each refresh.
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { checkAlerts } from "./extraStore";
import { getPrefs, snapshotWorth } from "./planStore";
import { dueKinds } from "./schedule";
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

/** Refreshes every symbol, or only `args.kinds` ("stock"/"crypto"); then alerts + a net worth snapshot. */
export async function refreshQuotes(args?: Record<string, unknown>) {
  const d = await getDb();
  const kinds = Array.isArray(args?.kinds) ? (args!.kinds as string[]) : null;
  const rows = (await d.select<WatchRow[]>("SELECT * FROM watchlist")).filter((r) => !kinds || kinds.includes(r.kind));

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
  await snapshotWorth().catch(() => {});
  await logActivity(
    "finance",
    "refresh_quotes",
    `checked ${rows.length} symbol(s)`,
    `${updated} updated${failed ? `, ${failed} failed` : ""}`
  );
  return { ok: true, updated, failed, fired };
}


// Last scheduled refresh per kind (this process). The schedule tick runs only while the
// module Auto-refresh opt-in is on; the per-kind intervals come from the Settings tab.
const last = { stock: 0, crypto: 0 };
export async function scheduledRefresh() {
  const now = Date.now();
  const kinds = dueKinds(now, last, await getPrefs());
  if (!kinds.length) return { ok: true, skipped: true };
  for (const k of kinds) last[k] = now;
  return refreshQuotes({ kinds });
}
