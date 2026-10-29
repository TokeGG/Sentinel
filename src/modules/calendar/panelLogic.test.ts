// Own timezone with a DST change so the day math is proven, not assumed.
process.env.TZ = "America/New_York";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bucketRows, dayKey, dayLabel, groupByDay, isOverdue, overdueCount, overdueText, sourceTag, itemTitle, timeText,
} from "./panelLogic.ts";

const L = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s);

describe("calendar panelLogic", () => {
  it("TZ is applied (DST fixtures below depend on it)", () => {
    assert.equal(L(2026, 3, 8, 12).getTimezoneOffset(), 240);
    assert.equal(L(2026, 1, 8, 12).getTimezoneOffset(), 300);
  });
  it("dayKey uses local date parts", () => {
    assert.equal(dayKey(L(2026, 10, 28, 23, 59, 59)), "2026-10-28");
    assert.equal(dayKey(L(2026, 10, 29, 0, 0, 0)), "2026-10-29");
    assert.equal(dayKey(new Date("nope")), null);
  });
  it("dayLabel: Today/Tomorrow/Yesterday/weekday/date", () => {
    const now = L(2026, 10, 28, 12); // Wednesday
    assert.equal(dayLabel(L(2026, 10, 28, 3), now), "Today");
    assert.equal(dayLabel(L(2026, 10, 29, 23, 59), now), "Tomorrow");
    assert.equal(dayLabel(L(2026, 10, 27, 8), now), "Yesterday");
    assert.equal(dayLabel(L(2026, 10, 31, 8), now), "Saturday, Oct 31");
    assert.equal(dayLabel(L(2026, 11, 3, 8), now), "Tuesday, Nov 3"); // +6 is still a weekday
    assert.equal(dayLabel(L(2026, 11, 4, 8), now), "Nov 4"); // +7 is a date
    assert.equal(dayLabel(L(2026, 11, 9, 8), now), "Nov 9");
    assert.equal(dayLabel(L(2027, 1, 2, 8), now), "Jan 2, 2027");
    assert.equal(dayLabel(new Date("nope"), now), "");
  });
  it("dayLabel is right across the spring-forward DST change (23h day)", () => {
    const now = L(2026, 3, 7, 23, 30); // Sat night, DST starts at 02:00 Sun Mar 8
    assert.equal(dayLabel(L(2026, 3, 8, 0, 15), now), "Tomorrow");
    assert.equal(dayLabel(L(2026, 3, 9, 0, 15), now), "Monday, Mar 9");
    const sun = L(2026, 3, 8, 23, 59);
    assert.equal(dayLabel(L(2026, 3, 9, 0, 0), sun), "Tomorrow");
    assert.equal(dayLabel(L(2026, 3, 8, 0, 0), sun), "Today");
  });
  it("dayLabel is right across the fall-back DST change (25h day)", () => {
    const now = L(2026, 10, 31, 23, 30); // DST ends 02:00 Sun Nov 1
    assert.equal(dayLabel(L(2026, 11, 1, 0, 5), now), "Tomorrow");
    assert.equal(dayLabel(L(2026, 11, 1, 23, 50), now), "Tomorrow");
    assert.equal(dayLabel(L(2026, 11, 2, 0, 5), now), "Monday, Nov 2");
    const sun = L(2026, 11, 1, 0, 30);
    assert.equal(dayLabel(L(2026, 11, 1, 23, 59), sun), "Today"); // 25h later is still today
  });
  it("midnight edges: 23:59:59 vs 00:00:00 are different days", () => {
    const now = L(2026, 10, 28, 23, 59, 59);
    assert.equal(dayLabel(L(2026, 10, 29, 0, 0, 0), now), "Tomorrow");
    assert.equal(dayLabel(L(2026, 10, 28, 0, 0, 0), now), "Today");
  });
  it("isOverdue: only task rows dated before today (local)", () => {
    const now = L(2026, 10, 28, 0, 0, 1);
    const task = (due: string) => ({ id: 1, task: true, due });
    assert.equal(isOverdue(task(L(2026, 10, 27, 23, 59, 59).toISOString()), now), true);
    assert.equal(isOverdue(task(L(2026, 10, 28, 0, 0, 0).toISOString()), now), false); // today
    assert.equal(isOverdue(task(L(2026, 10, 29, 9).toISOString()), now), false);
    assert.equal(isOverdue({ id: 2, due: L(2026, 1, 1).toISOString() }, now), false); // not a task
    assert.equal(isOverdue(task("not a date"), now), false);
    assert.equal(isOverdue({ id: 3, task: true }, now), false);
  });
  it("isOverdue reads SQLite UTC datetimes (22:30 NY on the 27th is 02:30Z on the 28th)", () => {
    const now = L(2026, 10, 28, 12);
    assert.equal(isOverdue({ task: true, due: "2026-10-28 02:30:00" }, now), true); // local Oct 27
    assert.equal(isOverdue({ task: true, due: "2026-10-28 06:00:00" }, now), false); // local Oct 28 02:00
  });
  it("groupByDay groups by local day, ascending, rows by time; skips invalid", () => {
    const now = L(2026, 10, 28, 12);
    const rows = [
      { id: "b", due: L(2026, 10, 29, 15).toISOString() },
      { id: "a", due: L(2026, 10, 29, 9).toISOString() },
      { id: "c", due: L(2026, 10, 28, 23, 59).toISOString() },
      { id: "x", due: "garbage" },
      { id: "y" },
    ];
    const g = groupByDay(rows, now);
    assert.deepEqual(g.map((x) => [x.day, x.label, x.rows.map((r) => r.id)]), [
      ["2026-10-28", "Today", ["c"]],
      ["2026-10-29", "Tomorrow", ["a", "b"]],
    ]);
  });
  it("groupByDay across DST puts 00:30 Sunday in Sunday, not Saturday", () => {
    const now = L(2026, 3, 7, 12);
    const g = groupByDay([{ id: 1, due: L(2026, 3, 8, 0, 30).toISOString() }, { id: 2, due: L(2026, 3, 7, 23, 30).toISOString() }], now);
    assert.deepEqual(g.map((x) => x.day), ["2026-03-07", "2026-03-08"]);
  });
  it("bucketRows: overdue / today / week (±6 days) / older count", () => {
    const now = L(2026, 10, 28, 12);
    const rows = [
      { id: 1, task: true, due: L(2026, 10, 20, 9).toISOString() }, // overdue task
      { id: 2, due: L(2026, 10, 28, 8).toISOString() },
      { id: 3, due: L(2026, 10, 26, 8).toISOString() },
      { id: 4, due: L(2026, 11, 3, 8).toISOString() },
      { id: 5, due: L(2026, 9, 1, 8).toISOString() }, // older, not a task
      { id: 6, task: true, due: L(2026, 10, 28, 8).toISOString() }, // today task -> today
      { id: 7 }, // undated
    ];
    const b = bucketRows(rows, now);
    assert.deepEqual(b.overdue.map((r) => r.id), [1]);
    assert.deepEqual(b.today.map((r) => r.id), [2, 6]);
    assert.deepEqual(b.week.flatMap((g) => g.rows.map((r) => r.id)), [3, 4]);
    assert.equal(b.older, 1);
    assert.equal(overdueCount(rows, now), 1);
  });
  it("sourceTag / itemTitle / timeText derive from sparse rows", () => {
    assert.equal(sourceTag({ source: "Deals" }), "Deals");
    assert.equal(sourceTag({ id: "note-4" }), "Notes");
    assert.equal(sourceTag({ id: "deal-4" }), "Deals");
    assert.equal(sourceTag({ id: "watch-4" }), "Finance");
    assert.equal(sourceTag({ id: "zzz-4" }), "Other");
    assert.equal(itemTitle({ text: "Buy milk", title: "Unfiled note: Buy milk" }), "Buy milk");
    assert.equal(itemTitle({ title: "Deal: GPU $300" }), "GPU $300");
    assert.equal(itemTitle({}), "Untitled");
    assert.equal(timeText({ due: L(2026, 10, 28, 9, 5).toISOString() }), "09:05");
    assert.equal(timeText({ due: "bad" }), "");
  });
  it("overdueText says unfiled/created, never a missed deadline", () => {
    const now = L(2026, 10, 28, 12);
    assert.equal(overdueText({ due: L(2026, 10, 20, 9).toISOString() }, now), "unfiled · created 8d ago");
    assert.equal(overdueText({}, now), "unfiled");
  });
});
