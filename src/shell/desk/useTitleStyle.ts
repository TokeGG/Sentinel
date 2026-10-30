// Title bar style from app_settings `titlebar_style` (normal|compact|autohide),
// re-read on DESK_CHANGED. Height stays TITLEBAR_H so panels never shift.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSetting } from "../../ui/appSetting";
import { DESK_CHANGED } from "./store";
import { toTitleStyle, type TitleStyle } from "./look";

export function useTitleStyle(): TitleStyle {
  const [s, setS] = useState<TitleStyle>("normal");
  useEffect(() => {
    const load = () => getSetting("titlebar_style").then((v) => setS(toTitleStyle(v))).catch(() => {});
    load();
    const un = listen(DESK_CHANGED, load);
    return () => { un.then((f) => f()).catch(() => {}); };
  }, []);
  return s;
}
