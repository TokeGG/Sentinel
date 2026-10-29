import { test } from "node:test";
import assert from "node:assert/strict";
import { PROVIDERS, clientGroups, endpoint, getProvider, redirectUri } from "./providers.ts";
import { CLIENT_IDS, resolveClientId } from "./clients.ts";

const https = (u: string) => new URL(endpoint(u, "example.social")).protocol === "https:";

test("every provider has https endpoints, scopes, a flow and a purpose", () => {
  const ids = new Set<string>();
  for (const p of PROVIDERS) {
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    assert.ok(https(p.tokenUrl), `${p.id} tokenUrl`);
    assert.ok(p.scopes.length > 0, `${p.id} scopes`);
    assert.ok(p.purpose && p.label);
    if (p.flow === "loopback-pkce") {
      assert.ok(p.authUrl && https(p.authUrl), `${p.id} authUrl`);
      assert.ok(p.redirect && p.redirect.port > 1024 && p.redirect.port < 65536, `${p.id} redirect`);
      assert.match(redirectUri(p), /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
    } else {
      assert.equal(p.flow, "device-code");
      assert.ok(p.deviceUrl && https(p.deviceUrl), `${p.id} deviceUrl`);
    }
    assert.ok(p.clientGroup !== null || p.dynamicInstance, `${p.id} needs a client source`);
  }
});

test("loopback ports are unique per client registration", () => {
  const ports = PROVIDERS.filter((p) => p.redirect).map((p) => `${p.clientGroup}:${p.redirect!.port}`);
  const byPort = new Map<number, string>();
  for (const p of PROVIDERS) {
    if (!p.redirect) continue;
    const g = byPort.get(p.redirect.port);
    assert.ok(g === undefined || g === p.clientGroup, `port ${p.redirect.port} shared across registrations`);
    byPort.set(p.redirect.port, p.clientGroup ?? "dyn");
  }
  assert.ok(ports.length > 0);
});

test("registry lookups", () => {
  assert.equal(getProvider("github").flow, "device-code");
  assert.throws(() => getProvider("nope"), /unknown/);
  assert.equal(endpoint("https://{instance}/oauth/token", "m.social"), "https://m.social/oauth/token");
  assert.equal(clientGroups().find((g) => g.group === "google")!.providers.length, 2);
  assert.equal(clientGroups().find((g) => g.group === "google")!.secret, true);
});

test("client ids: override beats shipped, shipped defaults are empty", () => {
  assert.ok(Object.values(CLIENT_IDS).every((v) => v === ""));
  assert.equal(resolveClientId("google", { google: " mine " }, { google: "shipped" }), "mine");
  assert.equal(resolveClientId("google", {}, { google: "shipped" }), "shipped");
  assert.equal(resolveClientId("twitch", {}), "");
});
