import { test } from "node:test";
import assert from "node:assert/strict";
import { easter, nthWeekday, observed } from "./holidayDates.ts";
import { enabledSets, holidaysFor, holidayTitle } from "./holidays.ts";
import { nagerUrl, parseNager, validCountry } from "./nager.ts";
import { parseCsv, csvCells } from "./csvImport.ts";
import { dealLinkOf, keptUrl } from "./dealLink.ts";
import { holidayRows } from "./holidayRows.ts";

test("computus and weekday math", () => {
  assert.equal(easter(2024), "2024-03-31");
  assert.equal(easter(2025), "2025-04-20");
  assert.equal(easter(2026), "2026-04-05");
  assert.equal(nthWeekday(2026, 11, 4, 4), "2026-11-26");
  assert.equal(nthWeekday(2026, 5, 1, -1), "2026-05-25");
  assert.equal(observed("2026-07-04"), "2026-07-03");
  assert.equal(observed("2027-12-25"), "2027-12-24");
});

test("US + shopping sets for 2026", () => {
  const h = holidaysFor(2026, ["us", "observances", "shopping"]);
  const day = (t: string) => h.find((x) => x.title === t)?.day;
  assert.equal(day("Martin Luther King Jr. Day"), "2026-01-19");
  assert.equal(day("Independence Day (observed)"), "2026-07-03");
  assert.equal(day("Mother's Day"), "2026-05-10");
  assert.equal(day("Black Friday"), "2026-11-27");
  assert.equal(day("Cyber Monday"), "2026-11-30");
});

test("defaults leave Prime Day off; approx + edits", () => {
  assert.ok(!enabledSets({}).includes("prime"));
  assert.ok(enabledSets({ prime: true }).includes("prime"));
  const g = holidaysFor(2026, ["gaming"], { "tga-2026": "2026-12-03", "tgs-2026": "" });
  assert.equal(g.find((x) => x.key === "tga-2026")?.day, "2026-12-03");
  assert.equal(g.find((x) => x.key === "tga-2026")?.approx, false);
  assert.ok(!g.some((x) => x.key === "tgs-2026"));
  assert.match(holidayTitle(g.find((x) => x.key === "steam-summer-2026")!), /approx until/);
});

test("nager parser", () => {
  assert.equal(nagerUrl(2026, "de"), "https://date.nager.at/api/v3/PublicHolidays/2026/DE");
  assert.ok(validCountry("gb") && !validCountry("gbr"));
  const h = parseNager([{ date: "2026-10-03", localName: "Tag", name: "German Unity Day" }, { date: "x", name: "bad" }], "de");
  assert.deepEqual(h.map((x) => [x.day, x.title, x.set]), [["2026-10-03", "German Unity Day", "nager:DE"]]);
  assert.throws(() => parseNager({}, "de"));
});

test("holiday rows are distinct all-day rows", () => {
  const rows = holidayRows([{ key: "k", day: "2026-11-26", title: "Thanksgiving", set: "us" }]);
  assert.equal(rows[0].holiday, true);
  assert.equal(rows[0].kind, "holiday");
  assert.equal(rows[0].allDay, true);
});

test("csv import with preview errors", () => {
  assert.deepEqual(csvCells('"a, b","x""y",3'), ["a, b", 'x"y', "3"]);
  const r = parseCsv("title,date,time,notes\nDentist,2026-11-02,9:30,bring card\n,2026-01-01\nX,2026-13-1\n");
  assert.deepEqual(r.rows, [{ title: "Dentist", day: "2026-11-02", time: "09:30", notes: "bring card" }]);
  assert.equal(r.errors.length, 2);
});

test("deal link kept and extracted", () => {
  assert.equal(keptUrl({ url: "https://shop.example/d/1" }), "https://shop.example/d/1");
  assert.equal(keptUrl({ link: "http://a.io/x" }), "http://a.io/x");
  assert.equal(keptUrl({ url: "javascript:alert(1)" }), null);
  assert.equal(dealLinkOf({ source: "Deals", url: "https://a.io/x" }), "https://a.io/x");
  assert.equal(dealLinkOf({ title: "Bill: Rent", url: "https://bank.example/pay" }), "https://bank.example/pay");
  assert.equal(dealLinkOf({ title: "Dentist", url: "https://a.io" }), null);
});
