// Snap settings: app_settings `snap_prefs` (JSON {on, gap}) written by Settings, mirrored
// into localStorage so chrome/grip webviews (which never open the DB) can read it.
import { getSetting, setSetting } from "../../ui/appSetting";
import { sanitizeSnap, type SnapPrefs } from "./zones";

const KEY = "snap_prefs";
const json = (v: string | null): unknown => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
const mirror = (p: SnapPrefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage off */ } };

/** Sync read for drag code (any webview). */
export function snapPrefsNow(): SnapPrefs {
  try { return sanitizeSnap(json(localStorage.getItem(KEY))); } catch { return sanitizeSnap(null); }
}
export async function loadSnapPrefs(): Promise<SnapPrefs> {
  const p = sanitizeSnap(json(await getSetting(KEY)));
  mirror(p);
  return p;
}
export async function saveSnapPrefs(p: SnapPrefs): Promise<void> {
  const s = sanitizeSnap(p);
  await setSetting(KEY, JSON.stringify(s));
  mirror(s);
}
