// Pure: what a module's body looks like. Deterministic from the id and ring.
import type { Ring } from "../core/module.ts";
import { hashId } from "./hue.ts";

export type Kind = "gas" | "rocky" | "ocean";
export type Look = { kind: Kind; ringed: boolean; atmosphere: boolean; seed: number };
const KINDS: Kind[] = ["gas", "rocky", "ocean"];

/** Inner rings (daily, media) are planets: atmosphere, a third have rings. Outer rings: small rocky/icy bodies. */
export function lookOf(id: string, ring: Ring): Look {
  const h = hashId(id), inner = ring === "daily" || ring === "media";
  const kind = inner ? KINDS[h % 3] : "rocky";
  return { kind, ringed: inner && (kind === "gas" ? h % 3 === 0 : h % 7 === 0), atmosphere: inner, seed: h };
}

/** mulberry32: small seeded PRNG for repeatable surface detail. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sprite radius bucket (steps of ~20%) so a wheel zoom does not rebuild sprites every tick. */
export function bucketR(r: number): number {
  return Math.pow(1.2, Math.ceil(Math.log(Math.max(r, 1)) / Math.log(1.2) - 1e-9));
}
