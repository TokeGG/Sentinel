import { test } from "node:test";
import assert from "node:assert/strict";
import { ReauthError, freshAccessToken, type HttpRes, type RefreshDeps, type TokenStore } from "./tokens.ts";
import type { TokenSet } from "./oauth.ts";
import type { Req } from "./requests.ts";

const EP = { url: "https://t.example/token", clientId: "cid" };

function rig(initial: TokenSet | null, reply: (r: Req) => HttpRes | Promise<HttpRes>) {
  const m = new Map<string, TokenSet>();
  if (initial) m.set("k", initial);
  const sent: Req[] = [];
  const store: TokenStore = { get: async (k) => m.get(k) ?? null, set: async (k, t) => void m.set(k, t), remove: async (k) => void m.delete(k) };
  const deps: RefreshDeps & { t: number } = { t: 1_000_000, now() { return this.t; }, send: async (r) => { sent.push(r); return reply(r); }, store };
  return { deps, sent, m };
}
const ok = (b: unknown): HttpRes => ({ ok: true, status: 200, json: async () => b });
const bad = (status: number, b: unknown = {}): HttpRes => ({ ok: false, status, json: async () => b });

test("fresh token is returned without a request", async () => {
  const r = rig({ accessToken: "A", refreshToken: "R", scopes: [], expiresAt: 1_000_000 + 600_000 }, () => ok({}));
  assert.equal(await freshAccessToken(r.deps, "k", EP), "A");
  assert.equal(r.sent.length, 0);
});

test("token inside the skew window refreshes and persists, keeping the refresh token", async () => {
  const r = rig({ accessToken: "A", refreshToken: "R", scopes: ["s"], expiresAt: 1_000_000 + 30_000 }, () => ok({ access_token: "B", expires_in: 3600 }));
  assert.equal(await freshAccessToken(r.deps, "k", EP), "B");
  assert.match(r.sent[0].body, /grant_type=refresh_token&refresh_token=R/);
  assert.equal(r.m.get("k")!.refreshToken, "R");
  assert.equal(r.m.get("k")!.expiresAt, 1_000_000 + 3_600_000);
});

test("concurrent callers share one refresh (rotating refresh tokens)", async () => {
  const r = rig({ accessToken: "A", refreshToken: "R", scopes: [], expiresAt: 0 }, () => ok({ access_token: "B", refresh_token: "R2", expires_in: 60 }));
  const out = await Promise.all([freshAccessToken(r.deps, "k", EP), freshAccessToken(r.deps, "k", EP), freshAccessToken(r.deps, "k", EP)]);
  assert.deepEqual(out, ["B", "B", "B"]);
  assert.equal(r.sent.length, 1);
  assert.equal(r.m.get("k")!.refreshToken, "R2");
});

test("invalid_grant clears the tokens and asks to reconnect", async () => {
  const r = rig({ accessToken: "A", refreshToken: "R", scopes: [], expiresAt: 0 }, () => bad(400, { error: "invalid_grant" }));
  await assert.rejects(freshAccessToken(r.deps, "k", EP), ReauthError);
  assert.equal(r.m.has("k"), false);
});

test("network or 5xx failures keep the tokens for a retry", async () => {
  const r = rig({ accessToken: "A", refreshToken: "R", scopes: [], expiresAt: 0 }, () => bad(503));
  await assert.rejects(freshAccessToken(r.deps, "k", EP), (e: Error) => !(e instanceof ReauthError) && /503/.test(e.message));
  assert.ok(r.m.has("k"));
  const n = rig({ accessToken: "A", refreshToken: "R", scopes: [], expiresAt: 0 }, () => { throw new Error("offline"); });
  await assert.rejects(freshAccessToken(n.deps, "k", EP), /Will retry/);
  assert.ok(n.m.has("k"));
});

test("no stored tokens or no refresh token -> reauth", async () => {
  await assert.rejects(freshAccessToken(rig(null, () => ok({})).deps, "k", EP), ReauthError);
  await assert.rejects(freshAccessToken(rig({ accessToken: "A", scopes: [], expiresAt: 1 }, () => ok({})).deps, "k", EP), ReauthError);
});
