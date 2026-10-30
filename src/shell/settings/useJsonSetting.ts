// Load/save one app_settings JSON value through a sanitizer; saving emits
// DESK_CHANGED so the main window and panels re-read it.
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getSetting, setSetting } from "../../ui/appSetting";
import { DESK_CHANGED } from "../desk/store";

export function useJsonSetting<T>(key: string, clean: (raw: unknown) => T, onError: (e: unknown) => void): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => clean(null));
  useEffect(() => {
    getSetting(key).then((s) => { try { setV(clean(JSON.parse(s ?? "null"))); } catch { setV(clean(null)); } }).catch(onError);
  }, [key]);
  const save = (next: T) => {
    const c = clean(next);
    setV(c);
    setSetting(key, JSON.stringify(c)).then(() => emit(DESK_CHANGED)).catch(onError);
  };
  return [v, save];
}
/** Plain string setting (flags "1"/"0", enums). */
export function useTextSetting(key: string, onError: (e: unknown) => void): [string, (v: string) => void] {
  const [v, setV] = useState("");
  useEffect(() => { getSetting(key).then((s) => setV(s ?? "")).catch(onError); }, [key]);
  return [v, (n: string) => { setV(n); setSetting(key, n).then(() => emit(DESK_CHANGED)).catch(onError); }];
}
