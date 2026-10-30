import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { byLabel, lastDays } from "./pomoStats.ts";

describe("pomodoro stats", () => {
  it("sums per day and label", () => {
    const rows = [{ started_at: "2026-10-30T09:00", minutes: 25, label: "a" }, { started_at: "2026-10-30T10:00", minutes: 25, label: "" }, { started_at: "2026-10-28T10:00", minutes: 50, label: "a" }];
    const d = lastDays(rows, new Date(2026, 9, 30, 12), 3);
    assert.deepEqual(d.map((x) => x.minutes), [50, 0, 50]);
    assert.deepEqual(byLabel(rows)[0], { label: "a", minutes: 75 });
  });
});
