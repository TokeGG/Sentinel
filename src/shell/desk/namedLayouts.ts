// Pure named layouts ("work", "gaming", "stream"): sanitize the stored JSON and
// compute which panels to close / open when switching.
import type { Rect } from "../layout.ts";

export type LayoutPanel = { id: string; rect: Rect };
export type Layouts = Record<string, LayoutPanel[]>;
export const PRESET_NAMES = ["work", "gaming", "stream"];
const NAME = /^[\w \-]{1,32}$/;

const isRect = (r: unknown): r is Rect =>
  !!r && typeof r === "object" && ["x", "y", "w", "h"].every((k) => Number.isFinite((r as Record<string, unknown>)[k]));

export function cleanName(n: string): string | null {
  const t = n.trim();
  return NAME.test(t) ? t : null;
}

export function sanitizeLayouts(raw: unknown): Layouts {
  const out: Layouts = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const name = cleanName(k);
    if (!name || !Array.isArray(v)) continue;
    out[name] = v.filter((p) => p && typeof p.id === "string" && isRect(p.rect)).map((p) => ({ id: p.id, rect: { ...p.rect } }));
  }
  return out;
}

export function switchPlan(openIds: string[], target: LayoutPanel[], known: (id: string) => boolean): { close: string[]; open: LayoutPanel[] } {
  const want = new Set(target.map((p) => p.id));
  return { close: openIds.filter((id) => !want.has(id)), open: target.filter((p) => known(p.id)) };
}
