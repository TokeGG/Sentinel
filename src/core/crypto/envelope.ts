// Pure encrypted envelope for settings export: PBKDF2-SHA256 -> AES-GCM 256.
// Uses WebCrypto only (webview + Node). The passphrase never leaves memory.
export const ITERATIONS = 310_000;
export type Envelope = { format: "sentinel-export"; v: 1; kdf: "PBKDF2-SHA256"; iter: number; salt: string; iv: string; data: string };

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const subtle = () => globalThis.crypto.subtle;

async function key(pass: string, salt: Uint8Array, iter: number) {
  const base = await subtle().importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(plaintext: string, pass: string, iter = ITERATIONS): Promise<Envelope> {
  if (pass.length < 8) throw new Error("passphrase must be at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, await key(pass, salt, iter), new TextEncoder().encode(plaintext));
  return { format: "sentinel-export", v: 1, kdf: "PBKDF2-SHA256", iter, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(ct)) };
}

export function parseEnvelope(text: string): Envelope {
  let e: Partial<Envelope>;
  try { e = JSON.parse(text); } catch { throw new Error("not a Sentinel export file"); }
  if (e?.format !== "sentinel-export" || e.v !== 1 || typeof e.salt !== "string" || typeof e.iv !== "string" || typeof e.data !== "string")
    throw new Error("not a Sentinel export file");
  if (!Number.isInteger(e.iter) || e.iter! < 100_000 || e.iter! > 5_000_000) throw new Error("export file has an invalid key setting");
  return e as Envelope;
}

export async function open(env: Envelope, pass: string): Promise<string> {
  try {
    const pt = await subtle().decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, await key(pass, unb64(env.salt), env.iter), unb64(env.data));
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("wrong passphrase or damaged file");
  }
}
