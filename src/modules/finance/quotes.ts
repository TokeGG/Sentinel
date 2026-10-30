// Quote refresh: provider chain (quoteFetch.ts) per symbol; price goes to `watchlist`,
// change/% /quote time/source/error per symbol to app_settings `fin_quotes` (JSON,
// no schema change). Price alerts are checked after each refresh.
import { getDb, logActivity } from "../../core/db";
import { checkAlerts } from "./extraStore";
import { getPrefs, snapshotWorth } from "./planStore";
import { dueKinds } from "./schedule";
import { fetchCrypto, fetchStock } from "./quoteFetch";
import type { WatchRow } from "./rows";

export interface QuoteStatus { change?: number | null; pct?: number | null; at?: string | null; source?: string; error?: string }
const KEY = "fin_quotes";

export async function readStatus(): Promise<Record<string, QuoteStatus>> {
  const d = await getDb();
  const r = await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [KEY]);
  try { return r[0] ? JSON.parse(r[0].value) : {}; } catch { return {}; }
}

/** Refreshes every symbol, or only `args.kinds` ("stock"/"crypto"); then alerts + a net worth snapshot. */
export async function refreshQuotes(args?: Record<string, unknown>) {
  const d = await getDb();
  const kinds = Array.isArray(args?.kinds) ? (args!.kinds as string[]) : null;
  const rows = (await d.select<WatchRow[]>("SELECT * FROM watchlist")).filter((r) => !kinds || kinds.includes(r.kind));
  const status: Record<string, QuoteStatus> = kinds ? await readStatus() : {};
  let updated = 0;
  const errors: string[] = [];
  for (const row of rows) {
    try {
      const q = row.kind === "crypto" ? await fetchCrypto(row.symbol) : await fetchStock(row.symbol);
      await d.execute("UPDATE watchlist SET last_price = $1, last_checked = datetime('now') WHERE id = $2", [q.price, row.id]);
      status[String(row.id)] = { change: q.change, pct: q.pct, at: q.at, source: q.source };
      updated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      status[String(row.id)] = { error: msg };
      errors.push(`${row.symbol.toUpperCase()}: ${msg}`);
    }
  }
  await d.execute(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [KEY, JSON.stringify(status)]
  );
  const fired = await checkAlerts();
  await snapshotWorth().catch(() => {});
  await logActivity("finance", "refresh_quotes", `checked ${rows.length} symbol(s)`,
    `${updated} updated${errors.length ? `, ${errors.length} failed` : ""}`);
  if (rows.length > 0 && updated === 0) throw new Error(`No prices: ${errors.slice(0, 3).join(" | ")}`);
  return { ok: true, updated, failed: errors.length, fired };
}

// Last scheduled refresh per kind (this process). The schedule tick runs only while the
// module Auto-refresh opt-in is on; the per-kind intervals come from Plan > Settings.
const last = { stock: 0, crypto: 0 };
export async function scheduledRefresh() {
  const now = Date.now();
  const kinds = dueKinds(now, last, await getPrefs());
  if (!kinds.length) return { ok: true, skipped: true };
  for (const k of kinds) last[k] = now;
  return refreshQuotes({ kinds });
}
