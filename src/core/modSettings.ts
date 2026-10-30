// Generic per-module settings (Settings > Modules), derived from each manifest, never per-module code.
// Stored where the app already keeps each concern: density / refresh / options in the active saved view
// (panel_prefs), notifications in notif_dnd, taste in taste_off:<id>; only Ask bar + link mode live in
// app_settings `modset:<id>` (JSON, sanitized on read).
import type { ModuleManifest } from "./module.ts";

export type LinkMode = "default" | "app" | "system";
export interface ModSettings { assist: boolean; links: LinkMode }
export const DEFAULT_MOD_SETTINGS: ModSettings = { assist: false, links: "default" };
export const modSettingsKey = (id: string) => `modset:${id}`;

export function readModSettings(json: string | null | undefined): ModSettings {
  let o: Record<string, unknown> = {};
  try { const j = JSON.parse(json ?? "{}"); if (j && typeof j === "object" && !Array.isArray(j)) o = j; } catch { /* defaults */ }
  return {
    assist: typeof o.assist === "boolean" ? o.assist : DEFAULT_MOD_SETTINGS.assist,
    links: o.links === "app" || o.links === "system" ? o.links : "default",
  };
}

/** Modules that use the shared taste layer (core/taste). */
export const TASTE_IDS: ReadonlySet<string> = new Set(["hub.news", "hub.deals", "hub.social", "hub.congress", "hub.github", "hub.youtube"]);

export type GenericField = "assist" | "links" | "notifications" | "density" | "refresh" | "defaultView" | "taste";
/** Which generic settings make sense for a manifest. */
export function genericFields(m: Pick<ModuleManifest, "id" | "panel" | "badge" | "load" | "schedule">): GenericField[] {
  const f: GenericField[] = [];
  if (m.panel === "custom" || m.panel === "list" || m.panel === "table") f.push("assist", "density", "defaultView");
  if (m.panel !== "web") f.push("links");
  if (m.badge || m.panel === "web") f.push("notifications");
  if (m.schedule || m.load) f.push("refresh");
  if (TASTE_IDS.has(m.id)) f.push("taste");
  return f;
}

export const REFRESH_CHOICES: (number | null)[] = [null, 5, 15, 30, 60, 240];
export const refreshLabel = (n: number | null) => (n === null ? "Off" : n < 60 ? `${n} min` : `${n / 60} h`);
