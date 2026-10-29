import { iconKnown } from "../shell/icons.ts";

export type OptionDef = {
  key: string;
  label: string;
  type: "toggle" | "select" | "number";
  default: boolean | string | number;
  choices?: string[];
  min?: number;
  max?: number;
};
export type CustomizeDef = {
  sections?: { id: string; label: string; default?: boolean }[];
  options?: OptionDef[];
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const blank = (v: unknown) => typeof v !== "string" || !v.trim();

export const HEX6 = /^#[0-9a-f]{6}$/i;

// Solar-system map placement (manifest `ring`, default "system") and glyph key.
export const RINGS = ["daily", "media", "system", "security"] as const;
export type Ring = (typeof RINGS)[number];
export function ringError(r: unknown): string | null {
  return r === undefined || RINGS.includes(r as Ring) ? null : `ring must be one of ${RINGS.join(", ")}, got ${JSON.stringify(r)}`;
}
export function iconError(i: unknown): string | null {
  return i === undefined || (typeof i === "string" && iconKnown(i)) ? null : `icon must be a key of ICONS, got ${JSON.stringify(i)}`;
}

export function accentError(a: unknown): string | null {
  return a === undefined || (typeof a === "string" && HEX6.test(a))
    ? null
    : `accent must be a #rrggbb color, got ${JSON.stringify(a)}`;
}

// Returns an error message (without the "where" prefix) or null if customize is fine.
// Takes unknown on purpose: manifests may come from untrusted/malformed sources.
export function customizeError(c: unknown): string | null {
  if (c === undefined) return null;
  if (!isObj(c)) return "customize must be an object";
  if (c.sections !== undefined && !Array.isArray(c.sections)) return "customize.sections must be an array";
  if (c.options !== undefined && !Array.isArray(c.options)) return "customize.options must be an array";
  const ids = new Set<string>();
  for (const s of (c.sections ?? []) as unknown[]) {
    if (!isObj(s)) return "a customize section must be an object";
    if (blank(s.id)) return "a customize section needs an id";
    if (ids.has(s.id as string)) return `duplicate customize section id "${s.id}"`;
    ids.add(s.id as string);
    if (s.default !== undefined && typeof s.default !== "boolean") {
      return `customize section "${s.id}" default must be a boolean`;
    }
  }
  const keys = new Set<string>();
  for (const o of (c.options ?? []) as unknown[]) {
    if (!isObj(o)) return "a customize option must be an object";
    if (blank(o.key)) return "a customize option needs a key";
    const k = o.key as string;
    if (keys.has(k)) return `duplicate customize option key "${k}"`;
    keys.add(k);
    const err = optionError(o);
    if (err) return `customize option "${k}" ${err}`;
  }
  return null;
}

function optionError(o: Record<string, unknown>): string | null {
  if (o.type !== "toggle" && o.type !== "select" && o.type !== "number") {
    return `type must be "toggle", "select" or "number"`;
  }
  if (o.type !== "select" && o.choices !== undefined) return "choices only valid on select options";
  if (o.type === "toggle") return typeof o.default === "boolean" ? null : "default must be a boolean";
  if (o.type === "select") {
    const ch = o.choices;
    if (!Array.isArray(ch) || ch.length === 0) return "(select) needs choices";
    if (ch.some((x) => blank(x)) || new Set(ch).size !== ch.length) {
      return "choices must be unique non-empty strings";
    }
    if (typeof o.default !== "string") return "default must be a string";
    return ch.includes(o.default) ? null : "default must be one of its choices";
  }
  for (const f of ["default", "min", "max"] as const) {
    if (o[f] !== undefined && !isNum(o[f])) return `${f} must be a finite number`;
  }
  if (!isNum(o.default)) return "default must be a finite number";
  const d = o.default as number;
  if (typeof o.min === "number" && typeof o.max === "number" && o.min > o.max) return "has min > max";
  if ((typeof o.min === "number" && d < o.min) || (typeof o.max === "number" && d > o.max)) {
    return "default must be within min..max";
  }
  return null;
}
