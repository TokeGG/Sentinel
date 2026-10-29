// Pure helpers: speed-test maths and the Pwned Passwords k-anonymity range check (only the first
// 5 hex chars of the SHA-1 ever leave the machine).
export const SPEED_URL = "https://speed.cloudflare.com/__down?bytes=25000000";
export const PWNED_URL = "https://api.pwnedpasswords.com/range/";

export function mbps(bytes: number, ms: number): number {
  if (!(bytes > 0) || !(ms > 0)) return 0;
  return Math.round(((bytes * 8) / (ms / 1000) / 1e6) * 10) / 10;
}

export async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const splitHash = (hex: string) => ({ prefix: hex.slice(0, 5), suffix: hex.slice(5) });

/** Count for `suffix` in a range response ("SUFFIX:COUNT" lines; padding rows have count 0). */
export function pwnedCount(body: string, suffix: string): number {
  for (const line of body.split(/\r?\n/)) {
    const [s, c] = line.trim().split(":");
    if (s?.toUpperCase() === suffix.toUpperCase()) return Number(c) || 0;
  }
  return 0;
}

/** Compare a computed hash with a pasted one (case/space-insensitive). */
export const sameHash = (a: string, b: string) => a.trim().toLowerCase() === b.replace(/\s+/g, "").toLowerCase() && a.trim() !== "";
