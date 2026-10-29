import { test } from "node:test";
import assert from "node:assert/strict";
import { hashId, hueOf } from "./hue.ts";

test("hueOf maps primaries", () => {
  assert.equal(hueOf("#ff0000"), 0);
  assert.equal(hueOf("#00ff00"), 120);
  assert.equal(hueOf("#0000ff"), 240);
  assert.equal(hueOf("#FFB454"), 34);
});
test("hueOf is null for grayscale and invalid input", () => {
  for (const v of ["#ffffff", "#000000", "#808080", "red", "#fff", "url(x)", "", undefined, 5])
    assert.equal(hueOf(v as string), null);
});
test("hueOf stays within 0..359", () => {
  assert.ok((hueOf("#ff0001") as number) <= 359);
});
test("hashId is stable FNV-1a", () => {
  assert.equal(hashId(""), 0x811c9dc5);
  assert.equal(hashId("hub.notes"), hashId("hub.notes"));
  assert.notEqual(hashId("hub.notes"), hashId("hub.news"));
});
