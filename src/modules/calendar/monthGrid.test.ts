process.env.TZ = "America/New_York";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { monthGrid } from "./monthGridLogic.ts";

const L = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);

describe("monthGrid", () => {
  const now = L(2026, 10, 28, 12);
  const g = monthGrid(
    [{ due: L(2026, 10, 28, 9).toISOString() }, { due: L(2026, 10, 28, 15).toISOString() }, { due: L(2026, 10, 5, 9).toISOString(), task: true }, { id: "undated" }],
    now,
  );
  it("covers whole Monday-first weeks of the month", () => {
    assert.equal(g.title, "October 2026");
    assert.equal(g.cells.length % 7, 0);
    assert.equal(g.cells[0].key, "2026-09-28"); // Oct 1 2026 is a Thursday
    assert.equal(g.cells.length, 35);
    assert.equal(g.cells.filter((c) => c.inMonth).length, 31);
  });
  it("counts items per local day and marks today and overdue", () => {
    const c = (k: string) => g.cells.find((x) => x.key === k)!;
    assert.equal(c("2026-10-28").count, 2);
    assert.equal(c("2026-10-28").today, true);
    assert.equal(c("2026-10-05").overdue, true);
    assert.equal(c("2026-10-06").count, 0);
  });
});
