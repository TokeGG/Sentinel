import type { ModuleManifest } from "../../core/module";
import { loadViews, saveView } from "../../ui/prefsStore";
import { applyAppearance, type Appearance } from "../settingsLogic";

/** Rewrites the ACTIVE view of every module. Keeps going on a failure and
 *  reports all failed modules at the end. Returns how many were updated. */
export async function applyToAll(mods: ModuleManifest[], a: Appearance, useAccent: boolean): Promise<number> {
  const failed: string[] = [];
  let done = 0;
  for (const m of mods) {
    try {
      const { views, active } = await loadViews(m.id, m.customize, m.accent ? { accent: m.accent } : undefined);
      const cur = views.find((v) => v.name === active) ?? views[0];
      await saveView(m.id, applyAppearance(cur, a, useAccent));
      done++;
    } catch (e) {
      failed.push(`${m.name} (${String(e)})`);
    }
  }
  if (failed.length) throw new Error(`Could not update: ${failed.join(", ")}`);
  return done;
}
