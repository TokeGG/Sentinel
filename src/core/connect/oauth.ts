// Pure OAuth2 helpers: authorization URL, token response parsing, expiry and
// refresh scheduling, scope sets. No I/O, no clock (callers pass `now`).
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms; undefined = the provider issued a non-expiring token. */
  expiresAt?: number;
  scopes: string[];
  idToken?: string;
}

export const SKEW_MS = 60_000;

export interface AuthParams {
  authUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  /** S256 challenge; empty = provider has no PKCE (Reddit). */
  challenge: string;
  extra?: Record<string, string>;
}

export function buildAuthUrl(p: AuthParams): string {
  const u = new URL(p.authUrl);
  const q = u.searchParams;
  q.set("client_id", p.clientId);
  q.set("response_type", "code");
  q.set("redirect_uri", p.redirectUri);
  if (p.scopes.length) q.set("scope", p.scopes.join(" "));
  q.set("state", p.state);
  if (p.challenge) {
    q.set("code_challenge", p.challenge);
    q.set("code_challenge_method", "S256");
  }
  for (const [k, v] of Object.entries(p.extra ?? {})) q.set(k, v);
  return u.toString();
}

export const splitScopes = (s: unknown): string[] =>
  typeof s === "string" ? s.split(/[\s,]+/).filter(Boolean) : Array.isArray(s) ? s.map(String) : [];

/** True when every wanted scope was granted (order and duplicates ignored). */
export const scopesCover = (granted: string[], wanted: string[]): boolean => {
  const g = new Set(granted);
  return wanted.every((s) => g.has(s));
};

export const missingScopes = (granted: string[], wanted: string[]): string[] => wanted.filter((s) => !granted.includes(s));

/** Parses a token endpoint JSON body; throws a message that never contains token values. */
export function parseTokenResponse(body: unknown, now: number, previous?: TokenSet): TokenSet {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.error === "string") {
    const d = typeof b.error_description === "string" ? `: ${b.error_description}` : "";
    throw new Error(`${b.error}${d}`);
  }
  if (typeof b.access_token !== "string" || !b.access_token) throw new Error("token response had no access_token");
  const ttl = Number(b.expires_in);
  return {
    accessToken: b.access_token,
    // Refresh responses often omit refresh_token: the old one stays valid.
    refreshToken: typeof b.refresh_token === "string" && b.refresh_token ? b.refresh_token : previous?.refreshToken,
    expiresAt: Number.isFinite(ttl) && ttl > 0 ? now + ttl * 1000 : undefined,
    scopes: b.scope === undefined ? (previous?.scopes ?? []) : splitScopes(b.scope),
    idToken: typeof b.id_token === "string" ? b.id_token : undefined,
  };
}

/** Needs a refresh when it expires within `skew` ms. Non-expiring tokens never do. */
export const isFresh = (t: TokenSet, now: number, skew = SKEW_MS): boolean =>
  t.expiresAt === undefined || t.expiresAt - skew > now;

export const form = (o: Record<string, string>): string => new URLSearchParams(o).toString();

/** Decodes a JWT payload (no signature check: used only to read our own sign-in's identity claims). */
export function jwtClaims(jwt: string | undefined): Record<string, unknown> {
  const part = jwt?.split(".")[1];
  if (!part) return {};
  try {
    const b = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)))) as Record<string, unknown>;
  } catch {
    return {};
  }
}
