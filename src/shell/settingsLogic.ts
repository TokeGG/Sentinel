// Pure Settings logic (no Tauri/React): schedule rows and appearance rules.
// Appearance values are untrusted (SQLite row) and always go through mergeView.
import type { ModuleManifest } from "../core/module.ts";
import { mergeView, type View } from "../ui/prefs.ts";

export type Appearance = { accent: string; density: "compact" | "roomy"; fontScale: number };
export type ScheduleRow = { id: string; name: string; everyMinutes: number; enabled: boolean };

export function scheduleRows(registry: ModuleManifest[], enabled: Record<string, boolean>): ScheduleRow[] {
  return registry
    .filter((m) => m.schedule)
    .map((m) => ({ id: m.id, name: m.name, everyMinutes: m.schedule!.intervalMinutes, enabled: enabled[m.id] === true }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function sanitizeAppearance(raw: unknown): Appearance {
  const v = mergeView(raw);
  return { accent: v.accent, density: v.density, fontScale: v.fontScale };
}

/** Appearance only: sections/options/name/tint/refresh are never touched. */
export function applyAppearance(view: View, appearance: Appearance, useAccent: boolean): View {
  const a = sanitizeAppearance(appearance);
  return { ...view, density: a.density, fontScale: a.fontScale, ...(useAccent ? { accent: a.accent } : {}) };
}
