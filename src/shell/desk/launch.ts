// "Launch into saved layout": if `launch_layout` names a saved layout, startup
// restores that instead of the last session. Returns null to fall back.
import type { LayoutRow } from "../layoutStore";
import { getDesk, getLayouts } from "./store";

/** Saturday or Sunday: the weekend profile layout applies (falls back to the weekday one). */
export const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export async function launchRows(known: Map<string, unknown>): Promise<LayoutRow[] | null> {
  const weekend = isWeekend(new Date());
  const name = (weekend && (await getDesk("launch_layout_weekend"))) || (await getDesk("launch_layout"));
  if (!name) return null;
  const l = (await getLayouts())[name];
  if (!l) return null;
  return l.filter((p) => known.has(p.id)).map((p, z) => ({ module_id: p.id, ...p.rect, z, state: "open" }));
}
