// In-app shortcuts (rebindable: app_settings `keymap`, see keymapUser.ts):
// mounted in the main window and in every panel webview; forwards to main.
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSetting } from "../../ui/appSetting";
import { cmdFor, effective, type Keymap } from "./keymapUser";
import { sendCmd } from "./shellCmd";
import { DESK_CHANGED } from "./store";

export function useAppKeys() {
  useEffect(() => {
    let map: Keymap = effective(null);
    const load = () => getSetting("keymap").then((v) => { try { map = effective(v ? JSON.parse(v) : null); } catch { map = effective(null); } }).catch(() => {});
    load();
    const un = listen(DESK_CHANGED, load);
    const on = (e: KeyboardEvent) => {
      const c = cmdFor(map, e);
      if (!c) return;
      e.preventDefault();
      sendCmd(c).catch(() => {});
    };
    window.addEventListener("keydown", on);
    return () => { window.removeEventListener("keydown", on); un.then((f) => f()); };
  }, []);
}
