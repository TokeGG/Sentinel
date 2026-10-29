// Pure helpers behind useModule (no React/Tauri) — unit-tested.
import type { ModuleManifest, SkillDef } from "../core/module.ts";

/** The manifest's skill by name; throws `unknown skill "x"` if absent. */
export function findSkill(m: ModuleManifest, name: string): SkillDef {
  const s = m.skills.find((x) => x.name === name);
  if (!s) throw new Error(`unknown skill "${name}"`);
  return s;
}

/** A displayable message for anything thrown; never empty. */
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === "string") return e || "unknown error";
  if (e === undefined || e === null) return "unknown error";
  return String(e);
}

/** Refresh period in ms, or null (off) for null/non-positive/non-finite minutes. */
export function intervalMs(minutes: number | null): number | null {
  return typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : null;
}
