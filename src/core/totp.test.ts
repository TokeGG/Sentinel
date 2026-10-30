import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { base32, parseOtp, secondsLeft, totp } from "./totp.ts";

describe("totp", () => {
  it("matches RFC 6238 SHA-1 vectors", async () => {
    const key = new TextEncoder().encode("12345678901234567890");
    assert.equal(await totp(key, 59_000, 8), "94287082");
    assert.equal(await totp(key, 1111111109_000, 8), "07081804");
  });
  it("decodes base32 and parses otpauth", () => {
    assert.deepEqual([...base32("MZXW6===")], [102, 111, 111]);
    assert.throws(() => base32("abc1"));
    assert.deepEqual(parseOtp("otpauth://totp/Site:me?secret=mzxw6&issuer=S", ""), { label: "Site:me", secret: "MZXW6" });
    assert.throws(() => parseOtp("MZXW6", ""));
    assert.equal(secondsLeft(31_000), 29);
  });
});
