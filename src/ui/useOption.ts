// Reads one customize option of the active view (falls back outside a panel
// or when the saved value has the wrong type).
import { useContext } from "react";
import { PanelContext } from "./Section";

export function useOption<T extends boolean | string | number>(key: string, fallback: T): T {
  const v = useContext(PanelContext).view?.options[key];
  return typeof v === typeof fallback ? (v as T) : fallback;
}
