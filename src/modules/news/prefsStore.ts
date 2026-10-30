// News prefs I/O (app_settings JSON): the opt-in auto-refresh skill that honours per-source intervals,
// and the keyword-alert count added to the News moon.
import { getDb } from "../../core/db";
import { readWords } from "../../core/spoiler";
import { getSetting, setSetting } from "../../ui/appSetting";
import { unseenCount } from "../congress/store";
import { ALERT_KEY, ALERT_SEEN_KEY, alertHits, dueSources, INTERVAL_KEY, LAST_KEY, readNumMap } from "./newsPrefsLogic";
import { enabledNewsSources } from "./sourceStore";
import { fetchFrom } from "./store";

/** Schedule skill (runs only after the user flips Auto-refresh): fetches sources whose interval has passed. */
export async function fetchFeedsAuto() {
  const now = Date.now();
  const last = readNumMap(await getSetting(LAST_KEY));
  const due = dueSources(await enabledNewsSources(), readNumMap(await getSetting(INTERVAL_KEY)), last, now);
  for (const s of due) last[s.url] = now;
  await setSetting(LAST_KEY, JSON.stringify(last));
  return due.length ? fetchFrom(due) : { added: 0, failed: 0 };
}

async function alertRows() {
  const words = readWords(await getSetting(ALERT_KEY));
  const seen = Number(await getSetting(ALERT_SEEN_KEY)) || 0;
  const rows = await (await getDb()).select<{ id: number; title: string }[]>("SELECT id, title FROM news_items WHERE id > $1 ORDER BY id DESC LIMIT 2000", [seen]);
  return alertHits(rows, words, seen);
}

/** Moon = congress updates + unseen keyword-alert headlines (counts only). */
export async function newsBadge(): Promise<number> {
  return (await unseenCount()) + (await alertRows().catch(() => [])).length;
}
export const alertCount = async () => (await alertRows()).length;
export async function markAlertsSeen() {
  const r = await (await getDb()).select<{ m: number | null }[]>("SELECT MAX(id) AS m FROM news_items");
  await setSetting(ALERT_SEEN_KEY, String(r[0]?.m ?? 0));
}
