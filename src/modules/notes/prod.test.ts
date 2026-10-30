import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boards, byCol, goalPct, meetingBody, milestonesFrom, moodAvg, nextPos, parseMilestones, shiftCol, stampLine, toggleMs, validMood, type KCard } from "./prod.ts";

describe("notes productivity", () => {
  it("kanban", () => {
    const c: KCard[] = [{ id: 1, board: "Main", col: "todo", title: "a", pos: 2 }, { id: 2, board: "Main", col: "todo", title: "b", pos: 1 }, { id: 3, board: "X", col: "done", title: "c", pos: 0 }];
    assert.deepEqual(byCol(c, "Main")[0].cards.map((k) => k.id), [2, 1]);
    assert.equal(shiftCol("todo", -1), null); assert.equal(shiftCol("todo", 1), "doing");
    assert.deepEqual(boards(c), ["Main", "X"]); assert.equal(nextPos(c, "Main", "todo"), 3); assert.equal(nextPos(c, "Main", "doing"), 0);
  });
  it("mood and goals", () => {
    assert.throws(() => validMood(6));
    assert.equal(moodAvg([{ day: "2026-01-01", mood: 1, note: "" }, { day: "2026-01-02", mood: 4, note: "" }], 1), 4);
    assert.equal(moodAvg([]), null);
    const ms = milestonesFrom("a\n\n b \n");
    assert.equal(goalPct(toggleMs(ms, 0)), 50);
    assert.deepEqual(parseMilestones("nope"), []);
  });
  it("meeting stamps", () => {
    assert.equal(stampLine(0, 3_725_000, " hi "), "[01:02:05] hi");
    assert.match(meetingBody("", "t", ["x"]), /untitled[\s\S]*- x/);
  });
});
