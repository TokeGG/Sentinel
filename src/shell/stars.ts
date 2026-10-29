// Pure night-sky star field: deterministic generation, rotation, twinkle.
export type Layer = 0 | 1 | 2;
export type Star = { x: number; y: number; r: number; layer: Layer; tw: number };

export const ROTATION_RATE = 0.004; // rad/s for the far layer

// mulberry32: small, fast, deterministic.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeStars(seed: number, count: number, w: number, h: number): Star[] {
  const rnd = rng(seed);
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    const u = rnd();
    const layer: Layer = u < 0.6 ? 0 : u < 0.85 ? 1 : 2;
    out.push({
      x: rnd() * w,
      y: rnd() * h,
      r: 0.8 + layer * 0.4 + rnd() * 0.7,
      layer,
      tw: rnd() * Math.PI * 2,
    });
  }
  return out;
}

// `angle` is the base rotation (elapsed seconds * ROTATION_RATE); nearer
// layers turn up to 2x faster.
export function rotate(s: Star, cx: number, cy: number, angle: number, layer: Layer): { x: number; y: number } {
  const a = angle * (1 + layer * 0.5);
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = s.x - cx, dy = s.y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export function twinkle(s: Star, tSec: number): number {
  const speed = 0.8 + s.layer * 0.4;
  return 0.675 + 0.325 * Math.sin(tSec * speed + s.tw);
}

// Pre-formatted fill styles per (color, alpha level): no string building per frame.
export const LEVELS = 8;
export const STAR_RGB = ["255,255,255", "190,215,255", "255,228,190"]; // white, pale blue, warm
export const alphaLevel = (a: number): number => Math.max(0, Math.min(LEVELS - 1, Math.round(a * (LEVELS - 1))));
const table = (k: number) =>
  STAR_RGB.map((rgb) => Array.from({ length: LEVELS }, (_, l) => `rgba(${rgb},${((l / (LEVELS - 1)) * k).toFixed(3)})`));
export const STAR_STYLES = table(1);
export const GLOW_STYLES = table(0.18);

// Accumulated animation time (seconds): paused frames add nothing, and a long
// gap (tab stall) is clamped so the field never jumps.
export const advance = (elapsed: number, dtMs: number, running: boolean): number =>
  running && dtMs > 0 ? elapsed + Math.min(dtMs, 250) / 1000 : elapsed;
