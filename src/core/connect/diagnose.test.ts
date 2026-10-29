import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProvider, explainError } from "./diagnose.ts";
import { getProvider } from "./providers.ts";

const bad = (c: { ok: boolean }[]) => c.filter((x) => !x.ok).length;

test("client id format per group", () => {
  assert.equal(bad(checkProvider(getProvider("google-mail"), "123-abc.apps.googleusercontent.com")), 0);
  assert.equal(bad(checkProvider(getProvider("google-mail"), "abc")), 1);
  assert.equal(bad(checkProvider(getProvider("microsoft-mail"), "0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b")), 0);
  assert.equal(bad(checkProvider(getProvider("twitch"), "")), 1);
  assert.equal(bad(checkProvider(getProvider("twitch"), "abcdefghijklmnopqrstuvwxyz0123")), 0);
  assert.equal(bad(checkProvider(getProvider("github"), "Ov23liAbCdEfGhIjKlMn")), 0);
});

test("mastodon needs no client id and has valid endpoints", () => {
  assert.equal(bad(checkProvider(getProvider("mastodon"), "")), 0);
});

test("errors map to a next step", () => {
  const g = getProvider("reddit");
  assert.match(explainError(g, "port_in_use: x"), /53684 is busy/);
  assert.match(explainError(g, "timeout: none"), /127\.0\.0\.1:53684/);
  assert.match(explainError(g, "invalid_client"), /client ID/);
  assert.match(explainError(getProvider("mastodon"), "invalid_client"), /reset/);
  assert.match(explainError(getProvider("github"), "device_flow_disabled"), /Enable Device Flow/);
  assert.match(explainError(g, "weird"), /sign-in failed: weird/);
});
