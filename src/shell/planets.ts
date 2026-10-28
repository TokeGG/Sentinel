import type { ModuleManifest } from "../core/module.ts";

export type PlanetPos = { id: string; x: number; y: number; r: number };

// FNV-1a 32-bit: stable across runs and platforms.
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Each planet gets its own grid cell (cells ordered by id hash), then a
// hash-derived jitter inside that cell. A planet never leaves its cell, so
// planets never overlap and always sit inside the box with radius margin.
export function planetsFor(modules: ModuleManifest[], size: { w: number; h: number }): PlanetPos[] {
  const n = modules.length;
  if (n === 0) return [];
  const w = Math.max(1, size.w);
  const h = Math.max(1, size.h);
  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / h)));
  const rows = Math.ceil(n / cols);
  const cw = w / cols;
  const ch = h / rows;
  const r = Math.max(4, Math.min(48, Math.min(cw, ch) * 0.28));
  const order = modules
    .map((m) => ({ id: m.id, hash: hashId(m.id) }))
    .sort((a, b) => a.hash - b.hash || (a.id < b.id ? -1 : 1));
  return order.map(({ id, hash }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const slackX = Math.max(0, cw - 2 * r);
    const slackY = Math.max(0, ch - 2 * r);
    const jx = (hash & 0xffff) / 0xffff;
    const jy = (hash >>> 16) / 0xffff;
    return { id, x: col * cw + r + slackX * jx, y: row * ch + r + slackY * jy, r };
  });
}
