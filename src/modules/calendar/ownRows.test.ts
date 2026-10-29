process.env.TZ = "America/New_York";
import { test } from "node:test";
import assert from "node:assert/strict";
import { localToIso, ownRows, type DbItem } from "./ownRows.ts";
import { toFields } from "./itemInput.ts";

const now = new Date(2026, 9, 29, 10, 0);
const item = (o: Partial<DbItem>): DbItem => ({ id: 1, kind: "event", title: "T", starts_at: null, ends_at: null, all_day: 0, rrule: null, notes: "", done: 0, parent_id: null, ...o });

test("localToIso reads local time (EDT = UTC-4) and all-day as local midnight", () => {
  assert.equal(localToIso("2026-10-30T13:00"), "2026-10-30T17:00:00.000Z");
  assert.equal(localToIso("2026-10-30"), "2026-10-30T04:00:00.000Z");
  assert.equal(localToIso("junk"), undefined);
});

test("a one-off event becomes one row; a weekly event is expanded inside the window only", () => {
  const one = ownRows([item({ starts_at: "2026-10-30T13:00" })], now);
  assert.deepEqual(one.map((r) => [r.id, r.due, r.source]), [["ev-1-2026-10-30", "2026-10-30T17:00:00.000Z", "Calendar"]]);
  const weekly = ownRows([item({ starts_at: "2026-10-01T09:00", rrule: "FREQ=WEEKLY" })], now);
  assert.ok(weekly.length > 8 && weekly.length < 14, String(weekly.length));
  assert.ok(weekly.every((r) => String(r.id).startsWith("ev-1-")));
  assert.equal(ownRows([item({ starts_at: "2020-01-01" })], now).length, 0);
});

test("tasks: one row, overdue only while not done, undated tasks have no due", () => {
  const [open, done, undated] = ownRows([
    item({ id: 2, kind: "task", starts_at: "2026-10-20" }),
    item({ id: 3, kind: "task", starts_at: "2026-10-20", done: 1 }),
    item({ id: 4, kind: "task" }),
  ], now);
  assert.deepEqual([open.task, open.source, open.kind], [true, "Tasks", "task"]);
  assert.deepEqual([done.task, done.done], [false, true]);
  assert.equal(undated.due, undefined);
});

test("toFields validates and normalizes", () => {
  assert.deepEqual(toFields({ kind: "event", title: " Lunch ", day: "2026-10-30", time: "13:00", repeat: "weekly", notes: " n " }), {
    kind: "event", title: "Lunch", startsAt: "2026-10-30T13:00", endsAt: null, allDay: false, rrule: "FREQ=WEEKLY", notes: "n", parentId: null,
  });
  const t = toFields({ kind: "task", title: "x", parent_id: 5 });
  assert.deepEqual([t.startsAt, t.allDay, t.parentId], [null, false, 5]);
  assert.equal(toFields({ title: "x", day: "2026-10-30" }).allDay, true);
  for (const bad of [{}, { title: "x" }, { title: "x", day: "2026-02-30" }, { title: "x", day: "2026-10-30", time: "25:00" }, { kind: "task", title: "x", time: "10:00" }, { kind: "task", title: "x", repeat: "daily" }])
    assert.throws(() => toFields(bad as Record<string, unknown>));
  assert.throws(() => toFields(undefined));
});
