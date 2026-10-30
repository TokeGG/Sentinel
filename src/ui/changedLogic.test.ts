import test from "node:test";
import assert from "node:assert/strict";
import { changedText, parseSeen } from "./changedLogic.ts";

test("changedText", () => {
  assert.equal(changedText(null, 5, 0), null);
  assert.equal(changedText({ at: 0, count: 5 }, 5, 1), null);
  assert.equal(changedText({ at: 0, count: 2 }, 5, 2 * 3600_000), "3 new since you last looked (2 h ago)");
  assert.deepEqual(parseSeen('{"at":1,"count":2}'), { at: 1, count: 2 });
  assert.equal(parseSeen("x"), null);
});
