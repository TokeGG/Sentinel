// Pinned clip ids, stored in SQLite clip_pins (toggle_pin skill). Pins saved by older
// builds in localStorage are moved into the DB once, then the local copy is removed.
import { useEffect } from "react";
import type { ModuleState } from "../../ui/useModule";
import { pinnedIds } from "./panelLogic";

const LEGACY = "sentinel.clipboard.pins";

function takeLegacy(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LEGACY) ?? "[]");
    localStorage.removeItem(LEGACY);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function usePins(rows: Record<string, unknown>[], run: ModuleState["run"]): [Set<string>, (id: string) => void] {
  useEffect(() => {
    const old = takeLegacy();
    if (old.length) void Promise.all(old.map((id) => run("toggle_pin", { id, on: true })));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [pinnedIds(rows), (id: string) => void run("toggle_pin", { id })];
}
