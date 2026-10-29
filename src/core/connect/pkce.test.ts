import { test } from "node:test";
import assert from "node:assert/strict";
import { VERIFIER_RE, base64url, challengeS256, newState, newVerifier } from "./pkce.ts";

test("S256 challenge matches the RFC 7636 appendix B vector", async () => {
  assert.equal(await challengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("verifier is 43 url-safe chars and state differs per call", () => {
  const v = newVerifier();
  assert.match(v, VERIFIER_RE);
  assert.equal(v.length, 43);
  assert.notEqual(newState(), newState());
});

test("base64url has no padding or +/", () => {
  assert.equal(base64url(new Uint8Array([251, 255, 254])), "-__-");
  assert.equal(base64url(new Uint8Array([1])), "AQ");
});

test("random source is injectable", () => {
  assert.equal(newVerifier(() => new Uint8Array(32)), "A".repeat(43));
});
