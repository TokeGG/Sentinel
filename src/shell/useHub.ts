import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Badges } from "./badges";
import { latestCounts, loadPrefs, NOTIF_LOGGED, NOTIF_PREFS_CHANGED, recentLog, savePrefs, type LogRow } from "./notifDb";
import { DEFAULT_PREFS, markAllRead, snoozeUntil, type NotifPrefs } from "./notifLogic";

// State + actions of the Master Hub panel (its own webview): reads prefs, the
// current unread picture and the history from SQLite; every change is saved,
// then announced so the main window re-reads. Counts and ids only.
export function useHub(onError: (e: unknown) => void) {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [counts, setCounts] = useState<Badges>({});
  const [log, setLog] = useState<LogRow[]>([]);
  const [ready, setReady] = useState(false);
  const reload = useCallback(() => {
    Promise.all([loadPrefs(), latestCounts(), recentLog(60)])
      .then(([p, c, l]) => { setPrefs(p); setCounts(c); setLog(l); setReady(true); })
      .catch(onError);
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener("focus", reload);
    const a = listen(NOTIF_LOGGED, reload), b = listen(NOTIF_PREFS_CHANGED, reload);
    return () => {
      window.removeEventListener("focus", reload);
      a.then((f) => f()).catch(() => {});
      b.then((f) => f()).catch(() => {});
    };
  }, []);
  const save = (next: NotifPrefs, field: keyof NotifPrefs) => { setPrefs(next); savePrefs(next, [field]).catch(onError); };
  return {
    prefs, counts, log, ready, reload,
    markAll: () => save(markAllRead(prefs, counts), "read"),
    snooze: (id: string, kind: "1h" | "tomorrow") => save({ ...prefs, snooze: { ...prefs.snooze, [id]: snoozeUntil(kind, new Date()) } }, "snooze"),
    unsnooze: (id: string) => { const s = { ...prefs.snooze }; delete s[id]; save({ ...prefs, snooze: s }, "snooze"); },
    toggleDnd: (id: string) => save({ ...prefs, dnd: prefs.dnd.includes(id) ? prefs.dnd.filter((x) => x !== id) : [...prefs.dnd, id] }, "dnd"),
  };
}
