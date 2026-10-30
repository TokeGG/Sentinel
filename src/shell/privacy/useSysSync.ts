// Main window: applies sys_prefs. Startup = end the last incognito session, opt-in history purge, lock on start.
// On change = low-power motion, presentation mode (closes the chosen panels once when it turns on).
import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getDb } from "../../core/db";
import { SETTINGS_CHANGED } from "../generalSettings";
import { setLowPower } from "../motionStore";
import { closePanel, restore } from "../panelApi";
import { purgeSteps } from "./history";
import { requestUnlock } from "./lockStore";
import { loadSys, saveSys } from "./sysPrefsStore";

async function startup(fail: (e: unknown) => void) {
  let p = await loadSys();
  if (p.incognito) p = await saveSys({ incognito: false }); // incognito is per session
  setLowPower(p.lowPower);
  if (p.lockOnStart) await requestUnlock("Sentinel was locked at startup");
  const d = await getDb();
  for (const s of purgeSteps(p.autoClearDays, Date.now())) await d.execute(s.sql, s.args).catch(fail);
}

/** Restore panels after the user's startup delay (0 = at once). */
export async function delayedRestore(): Promise<void> {
  const p = await loadSys().catch(() => null);
  const ms = (p?.startupDelaySec ?? 0) * 1000;
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  await restore();
}

export function useSysSync(fail: (e: unknown) => void) {
  const presenting = useRef(false);
  useEffect(() => {
    startup(fail).then(() => { presenting.current = false; }).catch(fail);
    const un = listen(SETTINGS_CHANGED, async () => {
      try {
        const p = await loadSys();
        setLowPower(p.lowPower);
        if (p.presentation && !presenting.current) {
          for (const id of p.presentationPanels) await closePanel(id).catch(() => {}); // not open = nothing to close
        }
        presenting.current = p.presentation;
      } catch (e) { fail(e); }
    });
    return () => void un.then((f) => f());
  }, []);
}
