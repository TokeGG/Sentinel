// Pure helpers for customize options: a clamped integer from a saved number option, and the
// generic "Start on tab" select option (choices = tab ids, default = the first tab).
import type { OptionDef } from "../core/customizeChecks.ts";

export function clampInt(v: unknown, def: number, lo: number, hi: number): number {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def;
}

/** Number option whose limits the panel reuses through `limitOf`. */
export const numOption = (key: string, label: string, def: number, min: number, max: number): OptionDef =>
  ({ key, label, type: "number", default: def, min, max });
export const limitOf = (o: OptionDef[], key: string, v: unknown): number => {
  const d = o.find((x) => x.key === key);
  return d ? clampInt(v, d.default as number, d.min ?? 1, d.max ?? 10_000) : clampInt(v, 0, 0, 10_000);
};

export const START_TAB = "startTab";
export const startTabOption = (tabs: readonly { id: string }[]): OptionDef =>
  ({ key: START_TAB, label: "Start on tab", type: "select", choices: tabs.map((t) => t.id), default: tabs[0].id });
/** The tab to show: the user's pick this session, else the saved start tab if it exists, else the first. */
export function startTab(tabs: readonly { id: string }[], chosen: string | null, saved: unknown): string {
  if (chosen && tabs.some((t) => t.id === chosen)) return chosen;
  if (typeof saved === "string" && tabs.some((t) => t.id === saved)) return saved;
  return tabs[0]?.id ?? "";
}
