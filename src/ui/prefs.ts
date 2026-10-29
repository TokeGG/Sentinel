// Pure view-preferences core (no Tauri/React). Every value that comes from a
// saved row or imported JSON is UNTRUSTED: mergeView sanitizes it, and nothing
// here ever produces raw CSS/HTML beyond validated scalar values.
import type { CustomizeDef } from "../core/customizeChecks.ts";

export type View = {
  name: string;
  accent: string;
  density: "compact" | "roomy";
  fontScale: number;
  tint: number;
  refreshMinutes: number | null;
  sections: { id: string; visible: boolean }[];
  options: Record<string, boolean | string | number>;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d;

const ACCENT = "#396cd8";
const okAccent = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
const okRefresh = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 ? Math.min(v, 1440) : null;
const okName = (v: unknown, d: string) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : d;

function appearance(raw: Record<string, unknown>, d: Omit<View, "name" | "sections" | "options">) {
  return {
    accent: okAccent(raw.accent, d.accent),
    density: raw.density === "compact" || raw.density === "roomy" ? raw.density : d.density,
    fontScale: num(raw.fontScale, 0.8, 1.4, d.fontScale),
    tint: num(raw.tint, 0, 1, d.tint),
    refreshMinutes: has(raw, "refreshMinutes") ? okRefresh(raw.refreshMinutes) : d.refreshMinutes,
  };
}

const BASE = { accent: ACCENT, density: "roomy", fontScale: 1, tint: 0.5, refreshMinutes: null } as const;

function optionValue(o: NonNullable<CustomizeDef["options"]>[number], raw: unknown) {
  if (o.type === "toggle") return typeof raw === "boolean" ? raw : (o.default as boolean);
  if (o.type === "select") {
    return typeof raw === "string" && o.choices?.includes(raw) ? raw : (o.default as string);
  }
  const lo = o.min ?? -Infinity;
  const hi = o.max ?? Infinity;
  return typeof raw === "number" && Number.isFinite(raw) ? clamp(raw, lo, hi) : (o.default as number);
}

export function defaultView(c?: CustomizeDef, name = "Default", base?: Partial<View>): View {
  const a = appearance(isObj(base) ? base : {}, BASE);
  return mergeSkeleton(name, a, c, {});
}

function mergeSkeleton(
  name: string,
  a: ReturnType<typeof appearance>,
  c: CustomizeDef | undefined,
  raw: Record<string, unknown>,
): View {
  const rawSecs = Array.isArray(raw.sections) ? raw.sections : [];
  const declared = new Map((c?.sections ?? []).map((s) => [s.id, s.default !== false]));
  const seen = new Set<string>();
  const sections: View["sections"] = [];
  for (const s of rawSecs) {
    if (!isObj(s) || typeof s.id !== "string" || !declared.has(s.id) || seen.has(s.id)) continue;
    seen.add(s.id);
    sections.push({ id: s.id, visible: typeof s.visible === "boolean" ? s.visible : declared.get(s.id)! });
  }
  for (const [id, vis] of declared) if (!seen.has(id)) sections.push({ id, visible: vis });
  const rawOpts = isObj(raw.options) ? raw.options : {};
  const options: View["options"] = {};
  for (const o of c?.options ?? []) options[o.key] = optionValue(o, has(rawOpts, o.key) ? rawOpts[o.key] : undefined);
  return { name, ...a, sections, options };
}

export function mergeView(raw: unknown, c?: CustomizeDef): View {
  try {
    const r = isObj(raw) ? raw : {};
    return mergeSkeleton(okName(r.name, "Default"), appearance(r, BASE), c, r);
  } catch {
    return defaultView(c);
  }
}

export function cssVars(v: View): Record<string, string> {
  return {
    "--accent": v.accent,
    "--density": v.density === "compact" ? "0.75" : "1",
    "--font-scale": String(v.fontScale),
    "--tint": String(v.tint),
  };
}

export function reorderSections(v: View, from: number, to: number): View {
  const n = v.sections.length;
  const ok = (i: number) => Number.isInteger(i) && i >= 0 && i < n;
  if (!ok(from) || !ok(to) || from === to) return v;
  const sections = v.sections.slice();
  sections.splice(to, 0, sections.splice(from, 1)[0]);
  return { ...v, sections };
}

export function setSectionVisible(v: View, id: string, visible: boolean): View {
  return { ...v, sections: v.sections.map((s) => (s.id === id ? { ...s, visible } : s)) };
}

export const exportView = (v: View): string => JSON.stringify(v, null, 2);

export function importView(json: string, c?: CustomizeDef): View {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("invalid view");
  }
  if (!isObj(raw)) throw new Error("invalid view");
  return mergeView(raw, c);
}
