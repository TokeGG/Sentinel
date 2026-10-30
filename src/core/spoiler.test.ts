import { it } from "node:test";
import assert from "node:assert/strict";
import { parseWords, readWords, spoilerHit } from "./spoiler.ts";

it("parses, lowercases and dedupes words", () => {
  assert.deepEqual(parseWords(" Finale, ending\nFINALE,, "), ["finale", "ending"]);
  assert.equal(parseWords("x".repeat(61)).length, 0);
});
it("reads stored JSON safely", () => {
  assert.deepEqual(readWords('["A", 3, "b"]'), ["a", "b"]);
  assert.deepEqual(readWords("nope"), []);
  assert.deepEqual(readWords(null), []);
});
it("finds a muted word in text", () => {
  assert.equal(spoilerHit("The Season Finale was wild", ["finale"]), "finale");
  assert.equal(spoilerHit("nothing here", ["finale"]), null);
  assert.equal(spoilerHit("anything", []), null);
});
