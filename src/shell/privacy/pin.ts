// App-lock PIN hashing (PBKDF2-SHA256 via WebCrypto). Only the encoded hash is kept, in the OS keychain
// (service `hub.lock`); the PIN itself is never stored or logged.
export const PIN_ITER = 210_000;
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));

export const validPin = (pin: string) => /^\d{4,12}$/.test(pin);

async function derive(pin: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter }, key, 256);
  return hex(new Uint8Array(bits));
}

/** "pbkdf2$<iter>$<salt hex>$<hash hex>". */
export async function hashPin(pin: string, iter = PIN_ITER, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<string> {
  if (!validPin(pin)) throw new Error("PIN must be 4-12 digits");
  return `pbkdf2$${iter}$${hex(salt)}$${await derive(pin, salt, iter)}`;
}

export async function verifyPin(pin: string, encoded: string | null): Promise<boolean> {
  const m = /^pbkdf2\$(\d+)\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(encoded ?? "");
  if (!m || !validPin(pin)) return false;
  const got = await derive(pin, unhex(m[2]), Number(m[1]));
  let diff = 0; // constant-time compare
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ m[3].charCodeAt(i);
  return diff === 0;
}

/** Seconds to wait after `fails` wrong tries (0 for the first 3, then doubling, max 5 min). */
export const lockoutSecs = (fails: number) => (fails < 3 ? 0 : Math.min(300, 2 ** (fails - 3) * 5));
