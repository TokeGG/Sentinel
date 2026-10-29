import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuick } from "./quickParse.ts";

const now = new Date(2026, 9, 29, 10, 30); // Thu Oct 29 2026, 10:30
const q = (s: string) => parseQuick(s, now);
const pick = (s: string) => { const r = q(s); return [r.title, r.kind, r.day, r.time, r.repeat]; };

test("weekday + time", () => {
  assert.deepEqual(pick("lunch Friday 1pm"), ["lunch", "event", "2026-10-30", "13:00", "none"]);
  assert.deepEqual(pick("lunch on next friday at 1:30 pm"), ["lunch", "event", "2026-10-30", "13:30", "none"]);
  assert.deepEqual(pick("standup thursday 9am"), ["standup", "event", "2026-11-05", "09:00", "none"]); // same weekday = next week
});

test("today, tomorrow, in N days, bare time rolls to tomorrow when passed", () => {
  assert.deepEqual(pick("call mom tomorrow at 5"), ["call mom", "event", "2026-10-30", "17:00", "none"]);
  assert.deepEqual(pick("gym today 18:00"), ["gym", "event", "2026-10-29", "18:00", "none"]);
  assert.deepEqual(pick("renew passport in 2 weeks"), ["renew passport", "event", "2026-11-12", null, "none"]);
  assert.deepEqual(pick("coffee 9am"), ["coffee", "event", "2026-10-30", "09:00", "none"]);
  assert.deepEqual(pick("coffee 11:15pm"), ["coffee", "event", "2026-10-29", "23:15", "none"]);
  assert.deepEqual(pick("sync 12am")[3], "00:00");
  assert.deepEqual(pick("lunch noon")[3], "12:00");
});

test("explicit dates: ISO, US numeric, month names, past dates roll to next year", () => {
  assert.deepEqual(pick("dentist 2026-11-02 9:30am"), ["dentist", "event", "2026-11-02", "09:30", "none"]);
  assert.deepEqual(pick("party 10/31"), ["party", "event", "2026-10-31", null, "none"]);
  assert.deepEqual(pick("trip dec 5th"), ["trip", "event", "2026-12-05", null, "none"]);
  assert.deepEqual(pick("trip 5 december 2027"), ["trip", "event", "2027-12-05", null, "none"]);
  assert.deepEqual(pick("taxes jan 15"), ["taxes", "event", "2027-01-15", null, "none"]);
});

test("recurrence words", () => {
  assert.deepEqual(pick("pay rent every month"), ["pay rent", "event", "2026-10-29", null, "monthly"]);
  assert.deepEqual(pick("standup daily 9:15"), ["standup", "event", "2026-10-30", "09:15", "daily"]);
  assert.deepEqual(pick("review every friday 4pm"), ["review", "event", "2026-10-30", "16:00", "weekly"]);
});

test("no date or time means a task; todo prefix forces a task", () => {
  assert.deepEqual(pick("buy milk"), ["buy milk", "task", null, null, "none"]);
  assert.deepEqual(pick("todo call bank friday"), ["call bank", "task", "2026-10-30", null, "none"]);
  assert.deepEqual(pick("remind me to stretch tomorrow 8am"), ["stretch", "task", "2026-10-30", "08:00", "none"]);
});

test("words that only look like dates stay in the title; empty input is safe", () => {
  assert.equal(q("monster truck show").title, "monster truck show");
  assert.equal(q("monster truck show").day, null);
  assert.equal(q("").title, "Untitled");
  assert.equal(parseQuick(undefined as unknown as string, now).kind, "task");
});
