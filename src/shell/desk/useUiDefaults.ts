// Shell-wide defaults from app_settings `ui_defaults`: one cached copy per webview, loaded once and
// re-read when any webview emits DESK_CHANGED (so many rows can call the hook cheaply).
import { useSyncExternalStore } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSetting } from "../../ui/appSetting";
import { DESK_CHANGED } from "./store";
import { DEFAULT_UI, parseUi, UI_DEFAULTS_KEY, type UiDefaults } from "./uiDefaults";

export const loadUiDefaults = async (): Promise<UiDefaults> => parseUi(await getSetting(UI_DEFAULTS_KEY).catch(() => null));

let cur: UiDefaults = DEFAULT_UI;
let started = false;
const subs = new Set<() => void>();
const refresh = () => loadUiDefaults().then((v) => { cur = v; subs.forEach((f) => f()); }).catch(() => {});

function subscribe(f: () => void) {
  subs.add(f);
  if (!started) {
    started = true;
    refresh();
    listen(DESK_CHANGED, refresh).catch(() => {});
  }
  return () => void subs.delete(f);
}

export const useUiDefaults = (): UiDefaults => useSyncExternalStore(subscribe, () => cur);
