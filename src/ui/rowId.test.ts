import { test } from "node:test";
import assert from "node:assert/strict";
import { daysArg, numericId } from "./rowId.ts";

test("numericId accepts numbers, numeric strings and prefixed ids", () => {
  assert.equal(numericId(4), 4);
  assert.equal(numericId("clip-12"), 12);
  assert.equal(numericId("7"), 7);
  for (const bad of [undefined, null, "", "x", -1, 1.5, "clip-"]) assert.throws(() => numericId(bad));
});

test("daysArg validates whole days", () => {
  assert.equal(daysArg("30"), 30);
  assert.equal(daysArg(0), 0);
  for (const bad of [-1, 1.2, "abc", 99999]) assert.throws(() => daysArg(bad));
});
