// Pure hit-testing against the planets' CURRENT screen positions (placeScene).
import type { Scene } from "./mapLayout.ts";

export const SUN = -2;
const SLOP = 4; // px of forgiveness around a planet or the sun

/** Nearest planet within its radius (+slop), else SUN if over the sun, else -1. */
export function hitTest(s: Scene, x: number, y: number, r: number): number {
  let best = -1, bestD = (r + SLOP) * (r + SLOP);
  for (let i = 0; i < s.slots.length; i++) {
    const dx = s.sx[i] - x, dy = s.sy[i] - y, d = dx * dx + dy * dy;
    if (d <= bestD) { best = i; bestD = d; }
  }
  if (best >= 0) return best;
  const dx = s.sunX - x, dy = s.sunY - y, sr = s.sunR + SLOP;
  return dx * dx + dy * dy <= sr * sr ? SUN : -1;
}
