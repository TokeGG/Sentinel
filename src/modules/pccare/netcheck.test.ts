import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mbps, pwnedCount, sameHash, sha1Hex, splitHash } from "./netcheck.ts";

describe("netcheck", () => {
  it("mbps", () => {
    assert.equal(mbps(25_000_000, 2000), 100);
    assert.equal(mbps(0, 10), 0);
    assert.equal(mbps(10, 0), 0);
  });
  it("sha1 prefix and range lookup", async () => {
    const h = await sha1Hex("password");
    assert.equal(h, "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
    const { prefix, suffix } = splitHash(h);
    assert.equal(prefix, "5BAA6");
    assert.equal(pwnedCount("0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n", suffix), 9545824);
    assert.equal(pwnedCount("AAAA:3", suffix), 0);
  });
  it("sameHash", () => {
    assert.ok(sameHash("abcd", " AB CD "));
    assert.ok(!sameHash("", ""));
    assert.ok(!sameHash("abcd", "abce"));
  });
});
