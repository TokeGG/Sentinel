import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREFS, diffCounts, fmtHM, groupMissed, inQuiet, isSnoozed, markAllRead, missedCount, muteKind, nextChangeMs,
  parseHM, reconcileRead, sanitizePrefs, shownCounts, snoozeUntil, totalOf, type NotifPrefs,
} from "./notifLogic.ts";

const at = (h: number, m = 0, day = 15) => new Date(2026, 9, day, h, m, 0, 0);
const prefs = (p: Partial<NotifPrefs>): NotifPrefs => ({ ...DEFAULT_PREFS, ...p });

test("quiet hours: same-day range, range wrapping midnight, empty and off", () => {
  const q = (start: string, end: string, on = true) => ({ on, start: parseHM(start)!, end: parseHM(end)! });
  assert.equal(inQuiet(q("09:00", "17:00"), 9 * 60), true);
  assert.equal(inQuiet(q("09:00", "17:00"), 17 * 60), false);
  assert.equal(inQuiet(q("22:00", "07:00"), 23 * 60 + 30), true);
  assert.equal(inQuiet(q("22:00", "07:00"), 3 * 60), true);
  assert.equal(inQuiet(q("22:00", "07:00"), 12 * 60), false);
  assert.equal(inQuiet(q("22:00", "07:00"), 7 * 60), false);
  assert.equal(inQuiet(q("08:00", "08:00"), 8 * 60), false);
  assert.equal(inQuiet(q("22:00", "07:00", false), 23 * 60), false);
});

test("parseHM / fmtHM", () => {
  assert.equal(parseHM("07:05"), 425);
  assert.equal(parseHM("24:00"), null);
  assert.equal(parseHM("7:5"), null);
  assert.equal(fmtHM(425), "07:05");
});

test("snooze: 1 hour and until 08:00 tomorrow; active only before the end", () => {
  const now = at(21, 30);
  assert.equal(snoozeUntil("1h", now), now.getTime() + 3600_000);
  assert.deepEqual(new Date(snoozeUntil("tomorrow", now)), at(8, 0, 16));
  assert.deepEqual(new Date(snoozeUntil("tomorrow", at(1, 0))), at(8, 0, 16));
  const p = prefs({ snooze: { "hub.a": 1000 } });
  assert.equal(isSnoozed(p, "hub.a", 999), true);
  assert.equal(isSnoozed(p, "hub.a", 1000), false);
  assert.equal(isSnoozed(p, "hub.b", 0), false);
});

test("muteKind: DND wins over snooze; nothing otherwise", () => {
  const p = prefs({ dnd: ["hub.a"], snooze: { "hub.a": 9e12, "hub.b": 9e12 } });
  assert.equal(muteKind(p, "hub.a", 1), "dnd");
  assert.equal(muteKind(p, "hub.b", 1), "snooze");
  assert.equal(muteKind(p, "hub.c", 1), null);
});

test("mark all read hides what was there, shows only newer items, and reconcile lowers the base", () => {
  const counts = { "hub.a": 5, "hub.b": 2, "hub.c": 0 };
  const p = markAllRead(DEFAULT_PREFS, counts);
  assert.deepEqual(p.read, { "hub.a": 5, "hub.b": 2 });
  assert.deepEqual(groupMissed(counts, p, 0), []);
  assert.deepEqual(groupMissed({ ...counts, "hub.a": 7 }, p, 0).map((r) => [r.id, r.count]), [["hub.a", 2]]);
  assert.equal(missedCount(3, 5), 0);
  assert.deepEqual(reconcileRead(p.read, { "hub.a": 3, "hub.b": 0 }), { "hub.a": 3 });
  assert.equal(reconcileRead(p.read, { "hub.a": 9 }), p.read); // same object when unchanged
  assert.equal(reconcileRead(p.read, {}), p.read); // no fresh count: keep
});

test("groupMissed sorts by count then id and keeps muted modules listed with their reason", () => {
  const p = prefs({ dnd: ["hub.b"], snooze: { "hub.c": 9e12 } });
  const rows = groupMissed({ "hub.a": 2, "hub.b": 9, "hub.c": 2, "hub.d": 0 }, p, 1);
  assert.deepEqual(rows.map((r) => [r.id, r.count, r.mute]), [["hub.b", 9, "dnd"], ["hub.a", 2, null], ["hub.c", 2, "snooze"]]);
});

test("shownCounts: read, DND, snooze and quiet hours mute moons; the raw counts are untouched", () => {
  const counts = { "hub.a": 4, "hub.b": 3, "hub.c": 6, "hub.d": 1 };
  const p = prefs({ dnd: ["hub.b"], snooze: { "hub.c": at(12).getTime() + 1 }, read: { "hub.a": 1 } });
  assert.deepEqual(shownCounts(counts, p, at(12)), { "hub.a": 3, "hub.d": 1 });
  assert.deepEqual(shownCounts(counts, p, at(13)), { "hub.a": 3, "hub.c": 6, "hub.d": 1 }); // snooze over
  const quiet = prefs({ quiet: { on: true, start: 22 * 60, end: 7 * 60 } });
  assert.deepEqual(shownCounts(counts, quiet, at(23)), {});
  assert.equal(totalOf(shownCounts(counts, quiet, at(12))), 14);
  assert.equal(counts["hub.b"], 3);
});

test("nextChangeMs: soonest snooze end or quiet edge", () => {
  const now = at(21, 0);
  assert.equal(nextChangeMs(DEFAULT_PREFS, now), null);
  assert.equal(nextChangeMs(prefs({ snooze: { a: now.getTime() + 5000 } }), now), 5000);
  assert.equal(nextChangeMs(prefs({ quiet: { on: true, start: 22 * 60, end: 7 * 60 } }), now), 3600_000);
  assert.equal(nextChangeMs(prefs({ quiet: { on: true, start: 21 * 60, end: 7 * 60 } }), now), 10 * 3600_000);
  assert.equal(nextChangeMs(prefs({ snooze: { a: now.getTime() - 1 } }), now), null);
});

test("diffCounts lists changed ids only (absent = 0)", () => {
  assert.deepEqual(diffCounts({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 }), [{ id: "b", count: 3 }, { id: "c", count: 4 }]);
  assert.deepEqual(diffCounts({ a: 1 }, {}), [{ id: "a", count: 0 }]);
  assert.deepEqual(diffCounts({ a: 0 }, {}), []);
});

test("sanitizePrefs survives junk and keeps good fields independently", () => {
  assert.deepEqual(sanitizePrefs(null), DEFAULT_PREFS);
  const p = sanitizePrefs({ snooze: { a: 5, b: "x", "": 3 }, dnd: ["a", 3, "a"], quiet: { on: true, start: 99999, end: 60 }, read: [1] });
  assert.deepEqual(p.snooze, { a: 5 });
  assert.deepEqual(p.dnd, ["a"]);
  assert.deepEqual(p.quiet, { on: true, start: 22 * 60, end: 60 });
  assert.deepEqual(p.read, {});
});

import { dndLabel, nextDnd, shownCounts as shown2, DEFAULT_PREFS as D2 } from "./notifLogic.ts";
test("global DND mutes everything until it ends; cycle and label", () => {
  const now = new Date(2026, 0, 1, 10, 0);
  assert.deepEqual(shown2({ a: 3 }, { ...D2, all: now.getTime() + 1000 }, now), {});
  assert.deepEqual(shown2({ a: 3 }, { ...D2, all: now.getTime() - 1 }, now), { a: 3 });
  const a = nextDnd(0, now);
  assert.equal(a - now.getTime(), 30 * 60000);
  assert.equal(nextDnd(nextDnd(nextDnd(a, now), now), now), new Date(2026, 0, 2, 8).getTime());
  assert.equal(nextDnd(new Date(2026, 0, 2, 8).getTime(), now), 0);
  assert.equal(dndLabel(now.getTime() + 90 * 60000, now.getTime()), "1h 30m");
});
