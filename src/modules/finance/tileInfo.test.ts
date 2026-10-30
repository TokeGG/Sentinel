import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { absText, dayChange, updatedText } from "./tileInfo.ts";

describe("finance tile info", () => {
  it("prefers provider change over session change", () => {
    assert.deepEqual(dayChange({ pct: 1.5, change: 2 }, { pct: 9, caption: "x" }), { pct: 1.5, abs: 2, caption: "today" });
    assert.deepEqual(dayChange({ asset: "crypto", pct: -3, change: -1 }, { pct: null, caption: "" }).caption, "24h");
    assert.deepEqual(dayChange({}, { pct: 4, caption: "since 1h ago" }), { pct: 4, abs: null, caption: "since 1h ago" });
  });
  it("formats updated time and abs change", () => {
    assert.match(updatedText({ last_checked: "2026-10-29 10:00:00", source: "Yahoo" }), /^Updated .+ · Yahoo$/);
    assert.equal(updatedText({}), "");
    assert.equal(absText(2.051), "+2.05");
    assert.equal(absText(-0.01234), "−0.0123");
    assert.equal(absText(null), "");
  });
});
