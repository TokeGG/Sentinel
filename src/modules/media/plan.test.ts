import { it } from "node:test";
import assert from "node:assert/strict";
import { countdown, dayTime, isLiveWindow, nextWeekly, parsePartyText, partyText, validHHMM } from "./plan.ts";

it("countdown text", () => {
  assert.equal(countdown(3_723_000, 0), "1:02:03");
  assert.equal(countdown(86_400_000 + 5000, 0), "1d 0:00:05");
  assert.equal(countdown(0, 10), "started");
});
it("party text round-trips its UTC time", () => {
  const t = Date.parse("2026-10-30T20:15:00Z");
  const s = partyText("Finals", t, "https://x.y");
  assert.equal(s, "Watch party: Finals starts 2026-10-30 20:15 UTC https://x.y");
  assert.equal(parsePartyText(s), t);
  assert.equal(parsePartyText("nothing"), null);
});
it("next weekly occurrence", () => {
  const now = new Date(2026, 9, 30, 12, 0).getTime(); // Friday
  const fri = new Date(nextWeekly(5, "18:30", now));
  assert.equal(fri.getDate(), 30); assert.equal(fri.getHours(), 18);
  assert.equal(new Date(nextWeekly(5, "09:00", now)).getDate(), 6); // next week
  assert.equal(new Date(nextWeekly(1, "10:00", now)).getDay(), 1);
});
it("day/time, live window, HH:MM check", () => {
  const ms = new Date(2026, 0, 2, 3, 4).getTime();
  assert.deepEqual(dayTime(ms), { day: "2026-01-02", time: "03:04" });
  assert.equal(isLiveWindow(0, 2, 3600000), true);
  assert.equal(isLiveWindow(0, 2, 7200000), false);
  assert.equal(validHHMM("23:59"), true); assert.equal(validHHMM("24:00"), false);
});
