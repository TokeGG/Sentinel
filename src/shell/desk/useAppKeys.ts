// In-app shortcuts (Ctrl+K, Ctrl+Shift+T, Alt+Left/Right, Ctrl+Shift+F, F1):
// mounted in the main window and in every panel webview; forwards to main.
import { useEffect } from "react";
import { keyToCmd } from "./keymap";
import { sendCmd } from "./shellCmd";

export function useAppKeys() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const c = keyToCmd(e);
      if (!c) return;
      e.preventDefault();
      sendCmd(c).catch(() => {});
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}
