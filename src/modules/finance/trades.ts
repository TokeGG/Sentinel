// Senate/House STOCK Act disclosures (free public datasets, unverified upstream schema).
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";

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

export async function syncCongressTrades() {
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

