// app_settings `sys_prefs` (one JSON row) + a tiny in-memory copy the main window subscribes to.
import { emit } from "@tauri-apps/api/event";
import { getSetting, setSetting } from "../../ui/appSetting";
import { SETTINGS_CHANGED } from "../generalSettings";
import { DEFAULT_SYS, parseSys, sanitizeSys, SYS_KEY, type SysPrefs } from "./sysPrefs";

let cur: SysPrefs = DEFAULT_SYS;
const subs = new Set<() => void>();

export const sysNow = () => cur;
export function subscribeSys(f: () => void): () => void {
  subs.add(f);
  return () => void subs.delete(f);
}

export async function loadSys(): Promise<SysPrefs> {
  cur = parseSys(await getSetting(SYS_KEY));
  subs.forEach((f) => f());
  return cur;
}

/** Saves a patch and tells the main window (another webview) to re-read. */
export async function saveSys(patch: Partial<SysPrefs>): Promise<SysPrefs> {
  const next = sanitizeSys({ ...(await loadSys()), ...patch });
  await setSetting(SYS_KEY, JSON.stringify(next));
  cur = next;
  subs.forEach((f) => f());
  await emit(SETTINGS_CHANGED, { key: SYS_KEY }).catch(() => {});
  return next;
}
