// Seeded randomness + classic encodings for the offline Practice CTF generator. Pure, deterministic.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

const bytes = (s: string) => new TextEncoder().encode(s);
export const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
export const hex = (s: string) => toHex(bytes(s));
export const b64 = (s: string) => btoa(String.fromCharCode(...bytes(s)));
export function caesar(s: string, k: number): string {
  return s.replace(/[a-z]/gi, (c) => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + k) % 26 + 26) % 26 + b); });
}
export const rot13 = (s: string) => caesar(s, 13);
export function vigenere(s: string, key: string, dir = 1): string {
  let i = 0;
  return s.replace(/[a-z]/gi, (c) => caesar(c, dir * (key.toLowerCase().charCodeAt(i++ % key.length) - 97)));
}
export const xorHex = (s: string, key: string) => toHex(bytes(s).map((b, i) => b ^ key.charCodeAt(i % key.length)));
export async function sha256Hex(s: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(s))));
}
export function shuffle<T>(r: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
