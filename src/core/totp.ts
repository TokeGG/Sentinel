// TOTP (RFC 6238, SHA-1, 30 s, 6 digits) with WebCrypto. Pure apart from crypto.subtle; secrets never stored here.
export function base32(s: string): Uint8Array {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", clean = s.toUpperCase().replace(/[\s=-]/g, "");
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error("secret must be base32 (A-Z, 2-7)");
  let bits = 0, val = 0; const out: number[] = [];
  for (const ch of clean) { val = (val << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export const secondsLeft = (nowMs: number, step = 30) => step - (Math.floor(nowMs / 1000) % step);

export async function totp(secret: string | Uint8Array, nowMs: number, digits = 6, step = 30): Promise<string> {
  const key = typeof secret === "string" ? base32(secret) : secret;
  const ctr = Math.floor(nowMs / 1000 / step), msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(0, Math.floor(ctr / 2 ** 32)); new DataView(msg.buffer).setUint32(4, ctr >>> 0);
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg)), o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, "0");
}
/** Accepts a raw base32 secret or an otpauth:// URI; returns label + secret. */
export function parseOtp(input: string, label: string): { label: string; secret: string } {
  const t = input.trim();
  if (t.startsWith("otpauth://")) {
    const u = new URL(t), sec = u.searchParams.get("secret") ?? "";
    base32(sec);
    return { label: label.trim() || decodeURIComponent(u.pathname.replace(/^\/+/, "")) || "code", secret: sec.toUpperCase() };
  }
  base32(t);
  if (!label.trim()) throw new Error("give the code a name");
  return { label: label.trim(), secret: t.toUpperCase().replace(/\s/g, "") };
}
