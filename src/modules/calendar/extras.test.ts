import { test } from "node:test";
import assert from "node:assert/strict";
import { blockError, blockedMinutes, fmtMin, moveTo, rowsOn, shiftAnchor, toMin, weekOf } from "./views.ts";
import { dueReminders, reminderDue, snoozeTo } from "./reminders.ts";
import { bestStreak, currentStreak, lastDays } from "./habits.ts";
import { clock, focusUntil, minutesOn, secondsLeft } from "./focus.ts";
import { normBday, parseVcards, upcomingBirthdays } from "./vcard.ts";
import { byCategory, monthlyCost, nextRenewal, validAmount } from "./money.ts";
import { filterBookmarks, normalizeUrl, titleFromUrl } from "./bookmarks.ts";

const now = new Date(2026, 9, 29, 14, 30); // Thu 29 Oct 2026

test("views: week, shifting, rows on a day, drag keeps time", () => {
  const w = weekOf(now);
  assert.equal(w[0].getDay(), 1);
  assert.equal(w[0].getDate(), 26);
  assert.equal(shiftAnchor(new Date(2026, 0, 31), "month", 1).getDate(), 28);
  assert.equal(shiftAnchor(now, "week", -1).getDate(), 22);
  const rows = [{ id: 1, due: "2026-10-29T09:00" }, { id: 2, due: "2026-10-30" }, { id: 3, due: "2026-10-29T08:00" }];
  assert.deepEqual(rowsOn(rows, "2026-10-29").map((r) => r.id), [3, 1]);
  assert.equal(moveTo("2026-10-01T09:15", "2026-10-05"), "2026-10-05T09:15");
  assert.equal(moveTo(null, "2026-10-05"), "2026-10-05");
  assert.throws(() => moveTo(null, "x"));
});
test("views: time blocks validate and refuse overlaps", () => {
  assert.equal(toMin("9:05"), 545);
  assert.equal(toMin("24:00"), null);
  assert.equal(fmtMin(545), "09:05");
  const have = [{ id: 1, day: "d", start_min: 540, end_min: 600, title: "Deep work" }];
  assert.match(blockError({ day: "d", start_min: 570, end_min: 630, title: "x" }, have)!, /Overlaps "Deep work"/);
  assert.equal(blockError({ day: "d", start_min: 600, end_min: 630, title: "x" }, have), null);
  assert.ok(blockError({ day: "d", start_min: 630, end_min: 600, title: "x" }, have));
  assert.equal(blockedMinutes(have, "d"), 60);
});
test("reminders: due, snooze, validation", () => {
  const list = [{ id: 1, title: "a", due_at: "2026-10-29T14:30", done: 0 }, { id: 2, title: "b", due_at: "2026-10-29T15:00", done: 0 }, { id: 3, title: "c", due_at: "2026-10-01T00:00", done: 1 }];
  assert.deepEqual(dueReminders(list, now).map((r) => r.id), [1]);
  assert.equal(snoozeTo(now, 10), "2026-10-29T14:40");
  assert.equal(reminderDue("2026-10-29", "08:00"), "2026-10-29T08:00");
  assert.throws(() => reminderDue("", "08:00"));
});
test("habits: current and best streak", () => {
  assert.equal(currentStreak(["2026-10-27", "2026-10-28", "2026-10-29"], now), 3);
  assert.equal(currentStreak(["2026-10-27", "2026-10-28"], now), 2);
  assert.equal(currentStreak(["2026-10-26"], now), 0);
  assert.equal(bestStreak(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-10"]), 3);
  assert.deepEqual(lastDays(now, 2), ["2026-10-28", "2026-10-29"]);
});
test("focus: until, seconds left, clock, minutes per day", () => {
  const u = focusUntil(now, 25);
  assert.equal(secondsLeft(u, now), 1500);
  assert.equal(secondsLeft(null, now), 0);
  assert.equal(secondsLeft(u, new Date(now.getTime() + 2e6)), 0);
  assert.throws(() => focusUntil(now, 0));
  assert.equal(clock(1500), "25:00");
  assert.equal(minutesOn([{ started_at: "2026-10-29T10:00", minutes: 25 }, { started_at: "2026-10-28T10:00", minutes: 5 }], "2026-10-29"), 25);
});
test("vcard: parses folded cards and birthdays", () => {
  const v = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Doe;Jane;;;\r\nEMAIL;TYPE=home:jane@x.org\r\nTEL:+1 555\r\n 0100\r\nBDAY:19901101\r\nEND:VCARD\r\nBEGIN:VCARD\nFN:Bob\\, Jr\nitem1.EMAIL:b@y.z\nBDAY:--11-05\nEND:VCARD\nBEGIN:VCARD\nEND:VCARD";
  const c = parseVcards(v);
  assert.deepEqual(c.map((x) => [x.name, x.emails, x.phones, x.birthday]), [["Jane Doe", "jane@x.org", "+1 5550100", "1990-11-01"], ["Bob, Jr", "b@y.z", "", "--11-05"]]);
  assert.equal(normBday("--0215"), "--02-15");
  const up = upcomingBirthdays(c, now, 10);
  assert.deepEqual(up.map((u) => [u.c.name, u.inDays, u.age]), [["Jane Doe", 3, 36], ["Bob, Jr", 7, null]]);
});
test("money: monthly cost, renewal, categories, amounts", () => {
  assert.equal(monthlyCost({ amount: 120, cycle: "yearly" }), 10);
  assert.equal(nextRenewal("2026-01-15", "monthly", now), "2026-11-15");
  assert.equal(nextRenewal("2026-10-29", "weekly", now), "2026-10-29");
  assert.equal(nextRenewal("2025-03-01", "yearly", now), "2027-03-01");
  const ex = [{ id: 1, day: "2026-10-01", amount: 5.1, category: "food", note: "" }, { id: 2, day: "2026-10-02", amount: 2.2, category: "food", note: "" }, { id: 3, day: "2026-09-02", amount: 9, category: "rent", note: "" }];
  assert.deepEqual(byCategory(ex, "2026-10"), [["food", 7.3]]);
  assert.equal(validAmount("3,456"), 3.46);
  assert.throws(() => validAmount("-1"));
});
test("bookmarks: normalise, title, filter", () => {
  assert.equal(normalizeUrl(" https://a.com/p?utm_source=x&id=2#top "), "https://a.com/p?id=2");
  assert.throws(() => normalizeUrl("javascript:alert(1)"));
  assert.equal(titleFromUrl("https://www.a.com/x"), "a.com/x");
  const l = [{ id: 1, url: "https://a", title: "Rust", tags: "dev", read: 0, saved_at: "" }, { id: 2, url: "https://b", title: "Cook", tags: "", read: 1, saved_at: "" }];
  assert.deepEqual(filterBookmarks(l, { unreadOnly: true }).map((b) => b.id), [1]);
  assert.deepEqual(filterBookmarks(l, { q: "DEV" }).map((b) => b.id), [1]);
});
