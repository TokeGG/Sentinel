// Reads this panel's generic module settings (core/modSettings) and applies the link mode.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { DEFAULT_MOD_SETTINGS, modSettingsKey, readModSettings, type ModSettings } from "../core/modSettings";
import { getSetting, setSetting } from "./appSetting";
import { setPanelLinkMode } from "./openLink";

export const MOD_SETTINGS_CHANGED = "mod-settings-changed";

export async function loadModSettings(id: string): Promise<ModSettings> {
  return readModSettings(await getSetting(modSettingsKey(id)).catch(() => null));
}
export async function saveModSettings(id: string, s: ModSettings): Promise<void> {
  await setSetting(modSettingsKey(id), JSON.stringify(s));
}

export function useModSettings(id: string): ModSettings {
  const [s, setS] = useState<ModSettings>(DEFAULT_MOD_SETTINGS);
  useEffect(() => {
    let alive = true;
    const read = () => loadModSettings(id).then((v) => { if (alive) { setS(v); setPanelLinkMode(v.links); } }, () => {});
    read();
    const un = listen<{ id?: string }>(MOD_SETTINGS_CHANGED, ({ payload }) => payload?.id === id && read());
    return () => { alive = false; void un.then((f) => f()).catch(() => {}); };
  }, [id]);
  return s;
}
