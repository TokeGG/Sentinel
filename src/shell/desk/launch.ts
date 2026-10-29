// "Launch into saved layout": if `launch_layout` names a saved layout, startup
// restores that instead of the last session. Returns null to fall back.
import type { LayoutRow } from "../layoutStore";
import { getDesk, getLayouts } from "./store";

export async function launchRows(known: Map<string, unknown>): Promise<LayoutRow[] | null> {
  const name = await getDesk("launch_layout");
  if (!name) return null;
  const l = (await getLayouts())[name];
  if (!l) return null;
  return l.filter((p) => known.has(p.id)).map((p, z) => ({ module_id: p.id, ...p.rect, z, state: "open" }));
}
