import { test } from "node:test";
import assert from "node:assert/strict";
import { nickOf, parseNicknames, parseTargets, scanDue, setNickname, splitTargets, validTarget } from "./extras.ts";

test("nicknames keyed by lower-case MAC", () => {
  let n = parseNicknames('{"AA:BB":"TV","x":3}');
  assert.deepEqual(n, { "aa:bb": "TV" });
  n = setNickname(n, "CC:DD", " Phone ");
  assert.equal(nickOf(n, "cc:dd"), "Phone");
  assert.equal(nickOf(setNickname(n, "aa:bb", ""), "AA:BB"), null);
  assert.deepEqual(parseNicknames("[1]"), {});
});
test("ping targets validated", () => {
  assert.equal(validTarget("1.1.1.1"), true);
  assert.equal(validTarget("300.1.1.1"), false);
  assert.equal(validTarget("example.com"), false);
  assert.equal(validTarget("http://x"), false);
  assert.deepEqual(splitTargets("1.1.1.1, example.com\nbad host;rm 1.1.1.1"), ["1.1.1.1"]);
  assert.deepEqual(parseTargets('["8.8.8.8", "a b"]'), ["8.8.8.8"]);
});
test("scan schedule off at 0, due after interval", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");
  assert.equal(scanDue(null, 0, now), false);
  assert.equal(scanDue(null, 6, now), true);
  assert.equal(scanDue("2026-01-01T08:00:00Z", 6, now), false);
  assert.equal(scanDue("2026-01-01T05:00:00Z", 6, now), true);
});
