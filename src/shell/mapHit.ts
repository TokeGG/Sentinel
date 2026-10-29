// Pure 3D hit-testing against the bodies' CURRENT screen positions (placeScene):
// of all discs under the pointer the NEAREST one wins, planets and sun alike.
import type { Scene } from "./mapLayout.ts";
import { pickNearest } from "./depth.ts";

export const SUN = -2;
const SLOP = 4; // px of forgiveness around a body

/** Planet index, SUN if the sun is the nearest body under (x, y), else -1. */
export function hitTest(s: Scene, x: number, y: number): number {
  const i = pickNearest(x, y, s.sx, s.sy, s.rad, s.sz, SLOP);
  return i < 0 ? -1 : i === s.slots.length ? SUN : i;
}
