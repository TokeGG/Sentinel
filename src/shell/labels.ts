// Pure label collision avoidance for the star map. Each planet's label tries a
// few anchor positions (below, above, right, left, below-far) and takes the
// first that stays on the canvas, overlaps no already placed label and covers
// no planet disc. Nearer planets are placed first (they win); the previous
// choice is tried first so labels do not flicker. Typed arrays, no allocation.
export const CAND = 5;
export type LabelSet = {
  n: number;
  x: Float64Array; y: Float64Array; r: Float64Array; w: Float64Array; // anchor centre, disc radius, text width
  ox: Float64Array; oy: Float64Array; // result: label top-left
  pick: Int8Array; // result: candidate index or -1 (hidden)
  prev: Int8Array;
};
export const makeLabelSet = (n: number): LabelSet => ({
  n, x: new Float64Array(n), y: new Float64Array(n), r: new Float64Array(n), w: new Float64Array(n),
  ox: new Float64Array(n), oy: new Float64Array(n), pick: new Int8Array(n).fill(-1), prev: new Int8Array(n).fill(0),
});

const GAP = 4;
/** Top-left of candidate `c` for label i of height h. */
export function candidate(L: LabelSet, i: number, c: number, h: number, out: { x: number; y: number }) {
  const x = L.x[i], y = L.y[i], r = L.r[i], w = L.w[i];
  switch (c) {
    case 0: out.x = x - w / 2; out.y = y + r + GAP; break;
    case 1: out.x = x - w / 2; out.y = y - r - GAP - h; break;
    case 2: out.x = x + r + GAP; out.y = y - h / 2; break;
    case 3: out.x = x - r - GAP - w; out.y = y - h / 2; break;
    default: out.x = x - w / 2; out.y = y + r + GAP + h + 2; break;
  }
  return out;
}

const rectHit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
const discHit = (rx: number, ry: number, rw: number, rh: number, cx: number, cy: number, cr: number) => {
  const nx = Math.max(rx, Math.min(cx, rx + rw)), ny = Math.max(ry, Math.min(cy, ry + rh));
  return (nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) < cr * cr;
};
const P = { x: 0, y: 0 };

/** `prio`: label indices, highest priority first (count = prioN). `forced`: always
 *  shown at the first candidate, ignoring collisions (the hovered one), -1 for none.
 *  `extra`: further obstacle discs (the sun), given as a centre + radius. */
export function layoutLabels(L: LabelSet, prio: ArrayLike<number>, prioN: number, h: number, W: number, H: number,
  forced = -1, sun?: { x: number; y: number; r: number }) {
  L.pick.fill(-1);
  const place = (i: number, c: number) => { L.pick[i] = c; L.prev[i] = c; L.ox[i] = P.x; L.oy[i] = P.y; };
  const free = (i: number, c: number): boolean => {
    candidate(L, i, c, h, P);
    if (P.x < 2 || P.y < 2 || P.x + L.w[i] > W - 2 || P.y + h > H - 2) return false;
    for (let j = 0; j < L.n; j++) {
      if (j === i) continue;
      if (L.pick[j] >= 0 && rectHit(P.x, P.y, L.w[i], h, L.ox[j], L.oy[j], L.w[j], h)) return false;
      if (discHit(P.x, P.y, L.w[i], h, L.x[j], L.y[j], L.r[j])) return false;
    }
    return !(sun && discHit(P.x, P.y, L.w[i], h, sun.x, sun.y, sun.r));
  };
  if (forced >= 0) { candidate(L, forced, 0, h, P); place(forced, 0); }
  for (let k = 0; k < prioN; k++) {
    const i = prio[k];
    if (i === forced || i < 0 || i >= L.n) continue;
    const first = L.prev[i];
    if (free(i, first)) { place(i, first); continue; }
    for (let c = 0; c < CAND; c++) if (c !== first && free(i, c)) { place(i, c); break; }
  }
}
