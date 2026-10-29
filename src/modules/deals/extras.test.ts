import { test } from "node:test";
import assert from "node:assert/strict";
import { dealKey, extractCodes, fairPrice, wishMatches } from "./extras.ts";

test("dealKey ignores price, percent, tag, store", () => {
  assert.equal(dealKey("[GPU] RTX 4070 Super $549 at Newegg"), dealKey("RTX 4070 Super - $599 (10% off) @ Amazon"));
});

test("fairPrice badge", () => {
  assert.equal(fairPrice(100, [120]), null);
  assert.equal(fairPrice(90, [100, 120, 110])?.badge, "lowest");
  assert.equal(fairPrice(110, [100, 120, 110])?.badge, "fair");
  assert.equal(fairPrice(150, [100, 120, 110])?.badge, "high");
  assert.equal(fairPrice(null, [1, 2]), null);
});

test("extractCodes", () => {
  assert.deepEqual(extractCodes("Use code SAVE20 at checkout; coupon: gamer10"), ["SAVE20", "GAMER10"]);
  assert.deepEqual(extractCodes("free shipping, code below"), []);
  assert.deepEqual(extractCodes("promo code SPRINGSALE"), ["SPRINGSALE"]);
});

test("wishMatches", () => {
  const w = { id: 1, term: "rtx 4070", max_price: 560 };
  assert.ok(wishMatches("RTX 4070 Super for $549", 549, w));
  assert.ok(!wishMatches("RTX 4070 Super for $599", 599, w));
  assert.ok(!wishMatches("RTX 4080", 500, w));
  assert.ok(wishMatches("RTX 4070", null, { ...w, max_price: null }));
});
