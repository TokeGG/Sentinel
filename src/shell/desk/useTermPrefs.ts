// Terminal home prefs from app_settings `term_prefs`; re-read when another webview emits DESK_CHANGED.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSetting, setSetting } from "../../ui/appSetting";
import { DESK_CHANGED } from "./store";
import { DEFAULT_TERM, parseTerm, sanitizeTerm, type TermPrefs } from "./termPrefs";

export const loadTermPrefs = async (): Promise<TermPrefs> => parseTerm(await getSetting("term_prefs"));
export const saveTermPrefs = (p: TermPrefs): Promise<void> => setSetting("term_prefs", JSON.stringify(sanitizeTerm(p)));

export function useTermPrefs(): TermPrefs {
  const [p, setP] = useState<TermPrefs>(DEFAULT_TERM);
  useEffect(() => {
    const load = () => loadTermPrefs().then(setP).catch(() => {});
    load();
    const un = listen(DESK_CHANGED, load);
    return () => void un.then((f) => f());
  }, []);
  return p;
}
