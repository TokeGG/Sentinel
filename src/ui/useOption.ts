// Reads one customize option of the active view (falls back outside a panel
// or when the saved value has the wrong type).
import { useContext } from "react";
import { PanelContext } from "./Section";
import type { OptionDef } from "../core/customizeChecks";
import { limitOf, START_TAB, startTab } from "./numOption";

export function useOption<T extends boolean | string | number>(key: string, fallback: T): T {
  const v = useContext(PanelContext).view?.options[key];
  return typeof v === typeof fallback ? (v as T) : fallback;
}

/** A number option clamped to its manifest def (see ui/numOption.ts). */
export function useLimit(options: OptionDef[], key: string): number {
  return limitOf(options, key, useContext(PanelContext).view?.options[key]);
}
/** Active tab: this session's pick, else the view's saved "Start on tab", else the first tab. */
export function useStartTab(tabs: readonly { id: string }[], chosen: string | null): string {
  return startTab(tabs, chosen, useContext(PanelContext).view?.options[START_TAB]);
}
