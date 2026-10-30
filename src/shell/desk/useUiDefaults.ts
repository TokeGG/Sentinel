// Shell-wide defaults from app_settings `ui_defaults`; re-read when another webview emits DESK_CHANGED.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSetting } from "../../ui/appSetting";
import { DESK_CHANGED } from "./store";
import { DEFAULT_UI, parseUi, UI_DEFAULTS_KEY, type UiDefaults } from "./uiDefaults";

export const loadUiDefaults = async (): Promise<UiDefaults> => parseUi(await getSetting(UI_DEFAULTS_KEY).catch(() => null));

export function useUiDefaults(): UiDefaults {
  const [p, setP] = useState<UiDefaults>(DEFAULT_UI);
  useEffect(() => {
    const load = () => loadUiDefaults().then(setP).catch(() => {});
    load();
    const un = listen(DESK_CHANGED, load);
    return () => void un.then((f) => f());
  }, []);
  return p;
}
