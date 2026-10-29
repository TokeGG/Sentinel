// Silent token refresh with injected I/O so it is testable with a fake clock and
// fetch. Refresh is single-flight per key: rotating refresh tokens (Microsoft,
// Twitch) must not be redeemed twice by two concurrent mail syncs.
import { isFresh, parseTokenResponse, type TokenSet } from "./oauth.ts";
import { refreshGrant, type Req, type TokenEndpoint } from "./requests.ts";

export interface TokenStore {
  get(key: string): Promise<TokenSet | null>;
  set(key: string, t: TokenSet): Promise<void>;
  remove(key: string): Promise<void>;
}
export interface HttpRes { ok: boolean; status: number; json(): Promise<unknown> }
export interface RefreshDeps {
  now(): number;
  send(r: Req): Promise<HttpRes>;
  store: TokenStore;
}

/** Thrown when the refresh token is dead: the user must press Connect again. */
export class ReauthError extends Error {
  constructor(msg: string) { super(msg); this.name = "ReauthError"; }
}

const inflight = new Map<string, Promise<TokenSet>>();

async function doRefresh(d: RefreshDeps, key: string, ep: TokenEndpoint, cur: TokenSet): Promise<TokenSet> {
  if (!cur.refreshToken) throw new ReauthError("Sign-in expired. Press Connect again.");
  let res: HttpRes;
  try {
    res = await d.send(refreshGrant(ep, cur.refreshToken));
  } catch {
    throw new Error("Could not reach the sign-in server to refresh. Will retry."); // transient: keep tokens
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = String((body as { error?: unknown }).error ?? "");
    if (res.status === 400 || res.status === 401 || err === "invalid_grant") {
      await d.store.remove(key);
      throw new ReauthError("Sign-in expired or was revoked. Press Connect again.");
    }
    throw new Error(`Token refresh failed (HTTP ${res.status}). Will retry.`);
  }
  const next = parseTokenResponse(body, d.now(), cur);
  await d.store.set(key, next);
  return next;
}

/** Returns a usable access token, refreshing first when it expires within the skew. */
export async function freshAccessToken(d: RefreshDeps, key: string, ep: TokenEndpoint, skew?: number): Promise<string> {
  const cur = await d.store.get(key);
  if (!cur) throw new ReauthError("Not connected. Press Connect first.");
  if (isFresh(cur, d.now(), skew)) return cur.accessToken;
  let p = inflight.get(key);
  if (!p) {
    p = doRefresh(d, key, ep, cur).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return (await p).accessToken;
}
