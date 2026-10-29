// Main window: tray unread total, opt-in toasts (counts only), opt-in global
// hotkeys, theme + day/night sky and ambient audio. All read from app_settings
// and re-applied when another webview emits DESK_CHANGED.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getShown, subscribeShown } from "../notifStore";
import { totalOf } from "../notifLogic";
import { getMotion } from "../motionStore";
import { startAmbient, stopAmbient } from "./ambient";
import { toastFor } from "./desktopLogic";
import { DESK_CHANGED, getDesk, getFlag } from "./store";
import { isTheme, SKY_TINT, skyPhase, THEMES } from "./theme";

function applyTheme(id: string) {
  const root = document.documentElement.style;
  for (const t of Object.values(THEMES)) for (const k of Object.keys(t)) root.removeProperty(k);
  if (isTheme(id)) for (const [k, v] of Object.entries(THEMES[id])) root.setProperty(k, v);
}

/** Returns the current sky tint for the star-map overlay. */
export function useDesktopSync(fail: (e: unknown) => void): string {
  const [tint, setTint] = useState("transparent");
  useEffect(() => {
    let toasts = false, sky = false, prev = totalOf(getShown());
    let timer: ReturnType<typeof setInterval> | null = null;
    const paintSky = () => setTint(sky ? SKY_TINT[skyPhase(new Date().getHours() + new Date().getMinutes() / 60)] : "transparent");
    const load = async () => {
      applyTheme(await getDesk("theme"));
      toasts = await getFlag("notif_toasts");
      sky = await getFlag("sky_clock");
      if (timer) clearInterval(timer);
      timer = sky ? setInterval(paintSky, 10 * 60_000) : null; // only while the user opted in
      paintSky();
      if (await getFlag("ambient_audio")) startAmbient(); else stopAmbient();
      await invoke("set_hotkeys", { summon: await getDesk("hotkey_summon"), capture: await getDesk("hotkey_capture") });
    };
    const onCounts = () => {
      const next = totalOf(getShown());
      invoke("set_tray_unread", { count: next }).catch(() => {});
      const text = toastFor(prev, next, toasts, getMotion().gameMode);
      prev = next;
      if (text && typeof Notification !== "undefined") {
        const show = () => new Notification("Sentinel", { body: text, silent: true });
        if (Notification.permission === "granted") show();
        else if (Notification.permission !== "denied") Notification.requestPermission().then((p) => p === "granted" && show());
      }
    };
    load().catch(fail);
    onCounts();
    const unsub = subscribeShown(onCounts);
    const un = listen(DESK_CHANGED, () => load().catch(fail));
    return () => { unsub(); un.then((f) => f()); if (timer) clearInterval(timer); stopAmbient(); };
  }, []);
  return tint;
}
