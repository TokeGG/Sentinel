import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCodeVerifier, codeChallengeFromVerifier } from "./pkce.ts";

describe("PKCE", () => {
  it("generates a verifier with no padding/plus/slash (base64url, RFC 7636)", () => {
    const v = generateCodeVerifier();
    assert.match(v, /^[A-Za-z0-9_-]{32,}$/);
  });

  it("generates different verifiers each call", () => {
    assert.notEqual(generateCodeVerifier(), generateCodeVerifier());
  });

  it("derives a stable challenge from the same verifier", async () => {
    const v = generateCodeVerifier();
    const c1 = await codeChallengeFromVerifier(v);
    const c2 = await codeChallengeFromVerifier(v);
    assert.equal(c1, c2);
    assert.match(c1, /^[A-Za-z0-9_-]+$/);
  });

  it("derives different challenges for different verifiers", async () => {
    const c1 = await codeChallengeFromVerifier(generateCodeVerifier());
    const c2 = await codeChallengeFromVerifier(generateCodeVerifier());
    assert.notEqual(c1, c2);
  });
});
