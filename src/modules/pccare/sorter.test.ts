import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupByMonth, planScreenshots, planSort } from "./sorter.ts";

const t = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h, 0, 0).getTime() / 1000;

describe("sorter", () => {
  it("plans moves by extension, skips unknown and partial files", () => {
    const p = planSort("C:\\Users\\me\\Downloads", [
      { name: "a.PDF", size: 1, modified: 0 }, { name: "b.zip", size: 1, modified: 0 },
      { name: "c.xyz", size: 1, modified: 0 }, { name: "d.exe.crdownload", size: 1, modified: 0 },
    ]);
    assert.deepEqual(p, [
      { from: "C:\\Users\\me\\Downloads\\a.PDF", folder: "Documents", name: "a.PDF" },
      { from: "C:\\Users\\me\\Downloads\\b.zip", folder: "Archives", name: "b.zip" },
    ]);
  });
  it("groups and renames screenshots by date, unique names", () => {
    const files = [
      { name: "x.png", size: 1, modified: t(2026, 3, 5, 10) },
      { name: "y.png", size: 1, modified: t(2026, 3, 5, 10) },
      { name: "z.jpg", size: 1, modified: t(2026, 4, 1) },
      { name: "n.txt", size: 1, modified: t(2026, 4, 1) },
    ];
    assert.deepEqual(groupByMonth(files).map((g) => [g.month, g.files.length]), [["2026-04", 1], ["2026-03", 2]]);
    const p = planScreenshots("/pics", files, true);
    assert.equal(p.length, 3);
    assert.equal(p[0].name, "Screenshot 2026-03-05 100000.png");
    assert.equal(p[1].name, "Screenshot 2026-03-05 100000 (2).png");
    assert.equal(p[2].folder, "2026-04");
    assert.equal(planScreenshots("/pics", files, false)[0].name, "x.png");
  });
});
