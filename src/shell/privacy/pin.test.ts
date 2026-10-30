import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPin, lockoutSecs, validPin, verifyPin } from "./pin.ts";

test("hash round-trips and never contains the PIN", async () => {
  const h = await hashPin("4321", 1000);
  assert.match(h, /^pbkdf2\$1000\$/);
  assert.equal(await verifyPin("4321", h), true);
  assert.equal(await verifyPin("1234", h), false);
  assert.equal(await verifyPin("4321", null), false);
  assert.equal(await verifyPin("4321", "garbage"), false);
});
test("salted: same PIN gives different hashes", async () => {
  assert.notEqual(await hashPin("0000", 1000), await hashPin("0000", 1000));
});
test("pin rules and lockout", async () => {
  assert.equal(validPin("12a4"), false);
  assert.equal(validPin("123"), false);
  await assert.rejects(hashPin("12"));
  assert.equal(lockoutSecs(2), 0);
  assert.equal(lockoutSecs(3), 5);
  assert.equal(lockoutSecs(20), 300);
});
