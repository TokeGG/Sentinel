import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getBadges, subscribeBadges } from "./badgeStore";
import type { Badges } from "./badges";
import { latestCounts, loadPrefs, logCounts, NOTIF_PREFS_CHANGED, pruneLog, savePrefs } from "./notifDb";
import { diffCounts, reconcileRead } from "./notifLogic";
import { getPrefs, setPrefs, startNotifStore } from "./notifStore";

// Main window only. Feeds notif_log from the badge flow (a row per count
// change; counts and ids only), keeps the notif prefs in sync with the DB
// and with the hub/Settings webviews (NOTIF_PREFS_CHANGED), and trims old
// "read" marks. No timers here; notifStore owns the one UI-refresh timeout.
export function useNotifLog(onError: (m: string) => void) {
  useEffect(() => {
    startNotifStore();
    let alive = true, prev: Badges = {}, queue: Promise<unknown> = Promise.resolve();
    const fail = (e: unknown) => alive && onError(`Notifications: ${String(e)}`);
    const reconcile = () => {
      const p = getPrefs(), read = reconcileRead(p.read, getBadges());
      if (read === p.read) return;
      const next = { ...p, read };
      setPrefs(next);
      savePrefs(next, ["read"], false).catch(fail);
    };
    const reload = () => loadPrefs().then((p) => { if (alive) { setPrefs(p); reconcile(); } }).catch(fail);
    // This session starts with no counts: close out whatever the last one left open, then log changes.
    queue = queue
      .then(() => pruneLog())
      .then(latestCounts)
      .then((old) => logCounts(Object.keys(old).map((id) => ({ id, count: 0 }))))
      .then(reload)
      .catch(fail);
    const un = subscribeBadges(() => {
      const next = getBadges(), rows = diffCounts(prev, next);
      prev = next;
      reconcile();
      if (rows.length) queue = queue.then(() => logCounts(rows)).catch(fail);
    });
    const unPrefs = listen(NOTIF_PREFS_CHANGED, () => void reload());
    return () => {
      alive = false;
      un();
      unPrefs.then((f) => f()).catch(() => {});
    };
  }, []);
}
