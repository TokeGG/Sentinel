import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fmtDur, shouldCount, totals } from "./timeTrack.ts";

describe("timeTrack", () => {
  it("counts only when enabled, visible and focused; sums", () => {
    assert.equal(shouldCount(false, true, true), false); assert.equal(shouldCount(true, true, true), true);
    assert.equal(fmtDur(3720), "1 h 2 min"); assert.equal(fmtDur(120), "2 min");
    assert.deepEqual(totals([{ day: "2026-10-01", panel_id: "a", secs: 60 }, { day: "2026-10-30", panel_id: "a", secs: 60 }, { day: "2026-10-30", panel_id: "b", secs: 300 }], "2026-10-24"), [{ panel: "b", secs: 300 }, { panel: "a", secs: 60 }]);
  });
});
