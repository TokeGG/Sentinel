// Main window: which home screen to show ("planets" default, or "terminal"); re-read on DESK_CHANGED.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { DESK_CHANGED, getDesk } from "./store";

export function useHomeStyle(): string {
  const [style, setStyle] = useState("planets");
  useEffect(() => {
    const load = () => getDesk("home_style").then((v) => setStyle(v || "planets")).catch(() => {});
    load();
    const un = listen(DESK_CHANGED, load);
    return () => void un.then((f) => f());
  }, []);
  return style;
}
