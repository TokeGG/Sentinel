// SQLite + events for notifications: prefs in app_settings (notif_snooze,
// notif_dnd, notif_quiet, notif_read) and the notif_log history. Counts and
// module ids only. Used by the main window (logging) and the Master Hub /
// Settings panels (they write prefs, then emit NOTIF_PREFS_CHANGED).
import { emit } from "@tauri-apps/api/event";
import { getDb } from "../core/db";
import type { Badges } from "./badges";
import { sanitizePrefs, type NotifPrefs } from "./notifLogic";

export const NOTIF_PREFS_CHANGED = "notif-prefs-changed";
export const NOTIF_LOGGED = "notif-logged";
export type LogRow = { id: number; module_id: string; count: number; at: number };
const KEYS = { snooze: "notif_snooze", dnd: "notif_dnd", quiet: "notif_quiet", read: "notif_read", all: "notif_all" } as const;
const KEEP_DAYS = 30;

export async function loadPrefs(): Promise<NotifPrefs> {
  const d = await getDb();
  const rows = await d.select<{ key: string; value: string }[]>("SELECT key, value FROM app_settings WHERE key LIKE 'notif\\_%' ESCAPE '\\'");
  const raw: Record<string, unknown> = {};
  for (const [name, key] of Object.entries(KEYS)) {
    const r = rows.find((x) => x.key === key);
    try { raw[name] = r ? JSON.parse(r.value) : undefined; } catch { raw[name] = undefined; }
  }
  return sanitizePrefs(raw);
}

/** Writes the given fields only; `announce` tells the main window to re-read. */
export async function savePrefs(p: NotifPrefs, fields: (keyof NotifPrefs)[], announce = true): Promise<void> {
  const d = await getDb();
  for (const f of fields) {
    await d.execute("INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2", [KEYS[f], JSON.stringify(p[f])]);
  }
  if (announce) await emit(NOTIF_PREFS_CHANGED, {});
}

export async function logCounts(rows: { id: string; count: number }[], at = Date.now()): Promise<void> {
  if (rows.length === 0) return;
  const d = await getDb();
  for (const r of rows) await d.execute("INSERT INTO notif_log (module_id, count, at) VALUES ($1, $2, $3)", [r.id, r.count, at]);
  await emit(NOTIF_LOGGED, {});
}

/** Latest logged count per module = the current unread picture. */
export async function latestCounts(): Promise<Badges> {
  const d = await getDb();
  const rows = await d.select<{ module_id: string; count: number }[]>(
    "SELECT module_id, count FROM notif_log WHERE id IN (SELECT MAX(id) FROM notif_log GROUP BY module_id)");
  const out: Badges = {};
  for (const r of rows) if (r.count > 0) out[r.module_id] = r.count;
  return out;
}

export async function recentLog(limit = 60): Promise<LogRow[]> {
  const d = await getDb();
  return d.select<LogRow[]>("SELECT id, module_id, count, at FROM notif_log ORDER BY id DESC LIMIT $1", [limit]);
}

export async function pruneLog(now = Date.now()): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM notif_log WHERE at < $1", [now - KEEP_DAYS * 86400_000]);
}
