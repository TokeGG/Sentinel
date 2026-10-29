// PKCE (RFC 7636) + state helpers. Pure apart from the injected random source,
// so tests can pin it. Uses WebCrypto (browser/WebView2 and Node 20+).
export type RandomBytes = (n: number) => Uint8Array;
export const systemRandom: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 43-char verifier from 32 random bytes (RFC 7636 wants 43..128 unreserved chars). */
export const newVerifier = (rnd: RandomBytes = systemRandom): string => base64url(rnd(32));
export const newState = (rnd: RandomBytes = systemRandom): string => base64url(rnd(16));

/** S256 challenge: BASE64URL(SHA256(ASCII(verifier))). */
export async function challengeS256(verifier: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(d));
}

export const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
