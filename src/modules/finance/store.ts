// Watchlist + trade rows for the panel.
import { getDb, logActivity } from "../../core/db";
import { toTradeRow, toWatchRow, type TradeRow, type WatchRow } from "./rows";

export async function addSymbol(args?: Record<string, unknown>) {
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

export async function removeSymbol(args?: Record<string, unknown>) {
  const id = Number(args?.id);
  if (!Number.isFinite(id)) throw new Error("symbol id missing");
  const d = await getDb();
  await d.execute("DELETE FROM watchlist WHERE id = $1", [id]);
  await logActivity("finance", "remove_symbol", `removed watchlist #${id}`, "ok");
  return { ok: true };
}

export async function loadRows(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const watched = await d.select<WatchRow[]>("SELECT w.*, COALESCE(g.grp, '') AS grp FROM watchlist w LEFT JOIN fin_groups g ON g.watch_id = w.id ORDER BY w.symbol ASC");
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

