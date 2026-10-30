// Per-panel time tracking (opt-in app_settings `time_track`, off by default; local SQLite `panel_time` only).
// Runs only inside an open panel webview, ticks once a minute while it is visible and focused.
import { useEffect } from "react";
import { getDb } from "../core/db";
import { getSetting } from "../ui/appSetting";
import { shouldCount, TICK_SECS, TIME_TRACK_KEY } from "./timeTrack";

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function useTimeTrack(panelId: string) {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined, live = true;
    void getSetting(TIME_TRACK_KEY).then((v) => {
      if (!live || v !== "1") return;
      timer = setInterval(() => {
        if (!shouldCount(true, document.visibilityState === "visible", document.hasFocus())) return;
        void getDb().then((db) => db.execute(
          "INSERT INTO panel_time (day, panel_id, secs) VALUES ($1,$2,$3) ON CONFLICT(day, panel_id) DO UPDATE SET secs = secs + $3", [today(), panelId, TICK_SECS])).catch(() => {});
      }, TICK_SECS * 1000);
    }).catch(() => {});
    return () => { live = false; if (timer) clearInterval(timer); };
  }, [panelId]);
}
export const listPanelTime = async () => (await getDb()).select<{ day: string; panel_id: string; secs: number }[]>("SELECT day, panel_id, secs FROM panel_time WHERE day >= date('now','-30 days')");
