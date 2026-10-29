// Terminal-look animations: on unless the OS asks for reduced motion AND the app's
// ignore_reduced_motion setting (Settings > General, default on) is off. Drives data-fx on the root.
import { useEffect, useState } from "react";
import { getIgnoreReduced } from "../../shell/layoutStore";
import { fxOn } from "./panelLogic";

export function useFx(): "1" | "0" {
  const [ignore, setIgnore] = useState(true);
  useEffect(() => { getIgnoreReduced().then(setIgnore).catch(() => {}); }, []);
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return fxOn(reduced, ignore) ? "1" : "0";
}
