process.env.TZ = "America/New_York";
import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeText, icsTime, parseIcs, serializeIcs, unescapeText, unfold } from "./ics.ts";

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;

test("unfold joins folded lines, handling CRLF and LF", () => {
  assert.deepEqual(unfold("A:one\r\n two\r\nB:x\n\ty"), ["A:onetwo", "B:xy"]);
});

test("text escapes round-trip (commas, semicolons, backslash, newline)", () => {
  const s = "a, b; c\\d\nline2";
  assert.equal(escapeText(s), "a\\, b\; c\\\\d\\nline2");
  assert.equal(unescapeText(escapeText(s)), s);
});

test("icsTime: all-day, floating, UTC (converted to local), garbage", () => {
  assert.deepEqual(icsTime("20261031", "VALUE=DATE"), { s: "2026-10-31", allDay: true });
  assert.deepEqual(icsTime("20261031T130000", "TZID=AMERICA/NEW_YORK"), { s: "2026-10-31T13:00", allDay: false });
  assert.deepEqual(icsTime("20261031T170000Z", ""), { s: "2026-10-31T13:00", allDay: false }); // EDT = UTC-4
  assert.deepEqual(icsTime("20261201T170000Z", ""), { s: "2026-12-01T12:00", allDay: false }); // EST = UTC-5
  assert.equal(icsTime("tomorrow", ""), null);
});

test("parseIcs reads basic VEVENTs with folding, escapes, RRULE and ignores VALARM", () => {
  const ics = wrap([
    "BEGIN:VEVENT", "UID:abc@x", "DTSTART:20261031T130000", "DTEND:20261031T140000",
    "SUMMARY:Lunch\\, with Sam", "DESCRIPTION:Bring the long\r\n  notes\\nline 2", "RRULE:FREQ=weekly;BYDAY=FR",
    "BEGIN:VALARM", "ACTION:DISPLAY", "SUMMARY:alarm", "END:VALARM", "END:VEVENT",
    "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261103", "SUMMARY:Trip", "END:VEVENT",
    "BEGIN:VEVENT", "DTSTART:20261102T090000Z", "SUMMARY:UTC call", "END:VEVENT",
  ].join("\r\n"));
  const { events, skipped } = parseIcs(ics);
  assert.equal(skipped, 0);
  assert.equal(events.length, 3);
  assert.deepEqual(events[0], {
    uid: "abc@x", title: "Lunch, with Sam", start: "2026-10-31T13:00", end: "2026-10-31T14:00", allDay: false,
    notes: "Bring the long notes\nline 2", rrule: "FREQ=WEEKLY;BYDAY=FR",
  });
  assert.deepEqual([events[1].start, events[1].end, events[1].allDay], ["2026-11-01", "2026-11-02", true]); // exclusive DTEND -> last day
  assert.equal(events[2].start, "2026-11-02T04:00"); // 09:00Z in EST
});

test("parseIcs skips events with no start/title or bad dates and survives junk", () => {
  const { events, skipped } = parseIcs(wrap("BEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261031\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:zzz\r\nSUMMARY:x\r\nEND:VEVENT"));
  assert.equal(events.length, 0);
  assert.equal(skipped, 3);
  assert.deepEqual(parseIcs("not a calendar"), { events: [], skipped: 0 });
  assert.deepEqual(parseIcs(undefined as unknown as string), { events: [], skipped: 0 });
});

test("unsupported RRULE freq is dropped; a non-positive span end becomes null", () => {
  const { events } = parseIcs(wrap("BEGIN:VEVENT\r\nDTSTART:20261031T100000\r\nDTEND:20261031T090000\r\nSUMMARY:x\r\nRRULE:FREQ=SECONDLY\r\nEND:VEVENT"));
  assert.equal(events[0].rrule, null);
  assert.equal(events[0].end, null);
});

test("serializeIcs output parses back to the same events (round trip) and folds long lines", () => {
  const evs = [
    { uid: "u1", title: "Lunch, Sam; ok", start: "2026-10-31T13:00", end: "2026-10-31T14:30", allDay: false, notes: "x".repeat(200) + "\nend", rrule: "FREQ=DAILY" },
    { uid: null, title: "Trip", start: "2026-11-01", end: "2026-11-02", allDay: true, notes: "", rrule: null },
    { uid: "u3", title: "One day", start: "2026-11-05", end: null, allDay: true, notes: "", rrule: null },
  ];
  const text = serializeIcs(evs, new Date("2026-10-29T12:00:00Z"));
  assert.match(text, /^BEGIN:VCALENDAR\r\n/);
  assert.match(text, /DTSTAMP:20261029T120000Z/);
  assert.match(text, /DTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261103/);
  for (const l of text.split("\r\n")) assert.ok(l.length <= 71, l.length + l);
  const back = parseIcs(text).events;
  assert.deepEqual(back.map((e) => ({ ...e, uid: e.uid && e.uid.startsWith("sentinel-") ? null : e.uid })), evs);
});
