// app_settings keys owned by the desktop batch (all opt-in, default off):
// hotkey_summon, hotkey_capture, notif_toasts, theme, sky_clock, ambient_audio,
// panel_layouts (JSON), launch_layout, panel_pins (JSON), tour_done.
import { getSetting, setSetting } from "../../ui/appSetting";
import { sanitizeLayouts, type Layouts } from "./namedLayouts";

export type DeskKey = "hotkey_summon" | "hotkey_capture" | "notif_toasts" | "theme" | "sky_clock" | "ambient_audio" | "launch_layout" | "tour_done" | "home_style";
export const getDesk = async (k: DeskKey): Promise<string> => (await getSetting(k)) ?? "";
export const setDesk = (k: DeskKey, v: string): Promise<void> => setSetting(k, v);
export const getFlag = async (k: DeskKey): Promise<boolean> => (await getSetting(k)) === "1";
export const setFlag = (k: DeskKey, on: boolean): Promise<void> => setSetting(k, on ? "1" : "0");

const json = (v: string | null): unknown => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
export const getLayouts = async (): Promise<Layouts> => sanitizeLayouts(json(await getSetting("panel_layouts")));
export const setLayouts = (l: Layouts): Promise<void> => setSetting("panel_layouts", JSON.stringify(sanitizeLayouts(l)));
export async function getPins(): Promise<string[]> {
  const v = json(await getSetting("panel_pins"));
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
export const setPins = (p: string[]): Promise<void> => setSetting("panel_pins", JSON.stringify([...new Set(p)]));
// Main window re-reads desktop settings when another webview changed them.
export const DESK_CHANGED = "desk-settings-changed";
