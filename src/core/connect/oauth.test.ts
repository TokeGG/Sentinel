import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuthUrl, isFresh, jwtClaims, parseTokenResponse, scopesCover, splitScopes } from "./oauth.ts";

test("buildAuthUrl carries PKCE S256, state, scopes and extras", () => {
  const u = new URL(buildAuthUrl({ authUrl: "https://a.example/auth?x=1", clientId: "cid", redirectUri: "http://127.0.0.1:1/cb", scopes: ["a", "b"], state: "S", challenge: "C", extra: { access_type: "offline" } }));
  const q = u.searchParams;
  assert.equal(q.get("x"), "1");
  assert.equal(q.get("response_type"), "code");
  assert.equal(q.get("code_challenge_method"), "S256");
  assert.equal(q.get("code_challenge"), "C");
  assert.equal(q.get("state"), "S");
  assert.equal(q.get("scope"), "a b");
  assert.equal(q.get("access_type"), "offline");
  assert.equal(q.get("redirect_uri"), "http://127.0.0.1:1/cb");
});

test("parseTokenResponse computes expiry and keeps the old refresh token", () => {
  const prev = { accessToken: "o", refreshToken: "R", scopes: ["x"] };
  const t = parseTokenResponse({ access_token: "n", expires_in: 3600 }, 1000, prev);
  assert.equal(t.accessToken, "n");
  assert.equal(t.refreshToken, "R");
  assert.equal(t.expiresAt, 1000 + 3_600_000);
  assert.deepEqual(t.scopes, ["x"]);
  assert.equal(parseTokenResponse({ access_token: "n", refresh_token: "R2", scope: "a b" }, 0).expiresAt, undefined);
});

test("parseTokenResponse errors name the problem but never echo tokens", () => {
  assert.throws(() => parseTokenResponse({ error: "invalid_grant", error_description: "Token expired" }, 0), /invalid_grant: Token expired/);
  assert.throws(() => parseTokenResponse({ refresh_token: "SECRET" }, 0), (e: Error) => !e.message.includes("SECRET") && /access_token/.test(e.message));
});

test("isFresh applies the skew", () => {
  const t = { accessToken: "a", scopes: [], expiresAt: 100_000 };
  assert.equal(isFresh(t, 30_000), true);
  assert.equal(isFresh(t, 40_001), false);
  assert.equal(isFresh({ accessToken: "a", scopes: [] }, 9e12), true);
});

test("scopes: split and cover", () => {
  assert.deepEqual(splitScopes("a b,c"), ["a", "b", "c"]);
  assert.equal(scopesCover(["a", "b"], ["b"]), true);
  assert.equal(scopesCover(["a"], ["a", "z"]), false);
});

test("jwtClaims reads the payload and tolerates junk", () => {
  const p = btoa(JSON.stringify({ email: "me@x.com" })).replace(/=+$/, "");
  assert.equal(jwtClaims(`h.${p}.s`).email, "me@x.com");
  assert.deepEqual(jwtClaims("garbage"), {});
  assert.deepEqual(jwtClaims(undefined), {});
});

test("buildAuthUrl omits PKCE params when the provider has none", () => {
  const q = new URL(buildAuthUrl({ authUrl: "https://a.example/auth", clientId: "c", redirectUri: "r", scopes: [], state: "S", challenge: "" })).searchParams;
  assert.equal(q.has("code_challenge"), false);
  assert.equal(q.has("scope"), false);
});
