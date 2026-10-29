// Import/export in mmoarena's shared/data/botbrain.json convention: { "<class>": { "<name>": number } }, numbers
// rounded to 3 decimals. A file written here can be copied into mmoarena (and back); keys the other side does not
// know are dropped on read, missing ones take the defaults, everything is clamped. Mirrors roundBrain in botlearn.ts.
import { clampBrain, type Brain, type BrainFile, type BrainSpec } from "./brain.ts";

export const roundBrain = (specs: readonly BrainSpec[], b: Brain): Brain =>
  Object.fromEntries(specs.map((s) => [s.name, Math.round((b[s.name] ?? s.default) * 1000) / 1000]));

/** The file contents (pretty JSON like botbrain.json) for the given brains. */
export function exportBrains(specs: readonly BrainSpec[], brains: Record<string, Brain>): string {
  const out: BrainFile = {};
  for (const [k, b] of Object.entries(brains)) out[k] = roundBrain(specs, clampBrain(specs, b));
  return JSON.stringify(out, null, 1) + "\n";
}

export type ImportResult = { ok: true; brains: BrainFile } | { ok: false; error: string };

/** Parse a botbrain.json-shaped text. Classes that are not objects are skipped; the whole file must be an object. */
export function importBrains(specs: readonly BrainSpec[], text: string, only?: readonly string[]): ImportResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "not valid JSON" }; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "expected an object with one entry per class" };
  const brains: BrainFile = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (only && !only.includes(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) brains[k] = roundBrain(specs, clampBrain(specs, v as Record<string, unknown>));
  }
  return { ok: true, brains };
}
