import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDay, occurrenceDays, parseRule, repeatOf, ruleFor } from "./recur.ts";

test("no rule: the start day only, if in range", () => {
  assert.deepEqual(occurrenceDays("2026-10-30T09:00", null, "2026-10-01", "2026-10-31"), ["2026-10-30"]);
  assert.deepEqual(occurrenceDays("2026-10-30", null, "2026-11-01", "2026-11-30"), []);
});

test("daily with interval, count and until", () => {
  assert.deepEqual(occurrenceDays("2026-10-30", "FREQ=DAILY", "2026-10-29", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.deepEqual(occurrenceDays("2026-10-30", "FREQ=DAILY;INTERVAL=2;COUNT=3", "2026-10-01", "2026-12-01"), ["2026-10-30", "2026-11-01", "2026-11-03"]);
  assert.deepEqual(occurrenceDays("2026-10-30", "FREQ=DAILY;UNTIL=20261101T000000Z", "2026-10-01", "2026-12-01"), ["2026-10-30", "2026-10-31", "2026-11-01"]);
});

test("COUNT counts occurrences before the window too", () => {
  assert.deepEqual(occurrenceDays("2026-10-01", "FREQ=DAILY;COUNT=5", "2026-10-04", "2026-10-31"), ["2026-10-04", "2026-10-05"]);
});

test("weekly: start weekday by default, BYDAY, and interval", () => {
  assert.deepEqual(occurrenceDays("2026-10-30", "FREQ=WEEKLY", "2026-10-30", "2026-11-14"), ["2026-10-30", "2026-11-06", "2026-11-13"]);
  assert.deepEqual(occurrenceDays("2026-10-26", "FREQ=WEEKLY;BYDAY=MO,WE", "2026-10-26", "2026-11-04"), ["2026-10-26", "2026-10-28", "2026-11-02", "2026-11-04"]);
  assert.deepEqual(occurrenceDays("2026-10-26", "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "2026-10-26", "2026-11-30"), ["2026-10-26", "2026-11-09", "2026-11-23"]);
});

test("monthly skips months lacking the day; yearly repeats the date", () => {
  assert.deepEqual(occurrenceDays("2026-01-31", "FREQ=MONTHLY", "2026-01-01", "2026-05-31"), ["2026-01-31", "2026-03-31", "2026-05-31"]);
  assert.deepEqual(occurrenceDays("2024-02-29", "FREQ=YEARLY", "2024-01-01", "2029-01-01"), ["2024-02-29", "2028-02-29"]);
});

test("nextDay advances a recurring item and ends a finished series", () => {
  assert.equal(nextDay("2026-10-30T09:00", "FREQ=WEEKLY"), "2026-11-06");
  assert.equal(nextDay("2026-10-30", null), null);
  assert.equal(nextDay("2026-10-30", "FREQ=DAILY;COUNT=1"), null);
});

test("rule helpers", () => {
  assert.equal(ruleFor("none"), null);
  assert.equal(ruleFor("weekly"), "FREQ=WEEKLY");
  assert.equal(repeatOf("FREQ=MONTHLY;INTERVAL=2"), "monthly");
  assert.equal(repeatOf("FREQ=YEARLY"), "none");
  assert.equal(repeatOf(null), "none");
  assert.deepEqual(parseRule("FREQ=WEEKLY;BYDAY=MO,-1FR;INTERVAL=0").byday, [1, 5]);
  assert.equal(parseRule("FREQ=DAILY;INTERVAL=0").interval, 1);
});
