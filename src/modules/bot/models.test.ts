import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { benchBody, fmtSize, loadedNames, parseTags, pullPct, shouldUnload, tokensPerSec, validModelName } from "./models.ts";

describe("model manager", () => {
  it("parses tags/ps, sizes, progress, speed", () => {
    assert.deepEqual(parseTags('{"models":[{"name":"a:1","size":2000000000,"modified_at":"x"},{}]}'), [{ name: "a:1", size: 2e9, modified: "x" }]);
    assert.deepEqual(loadedNames("bad"), []);
    assert.equal(fmtSize(2e9), "2.0 GB"); assert.equal(fmtSize(5e8), "500 MB");
    assert.equal(pullPct({ completed: 50, total: 200 }), 25); assert.equal(pullPct({}), null);
    assert.equal(tokensPerSec('{"eval_count":50,"eval_duration":2000000000}'), 25);
    assert.equal(JSON.parse(benchBody("m")).stream, false);
  });
  it("unload only when opted in and validates names", () => {
    assert.equal(shouldUnload("1", true), true); assert.equal(shouldUnload(null, true), false); assert.equal(shouldUnload("1", false), false);
    assert.ok(validModelName("llama3:8b")); assert.ok(!validModelName("a b")); assert.ok(!validModelName("../x"));
  });
});
