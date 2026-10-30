import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addDate, EMPTY, logTime, parseState, pct, remove, removeDate, step, upsert } from "./logic.ts";
import { calendarArgs, importLab, sortCourses, upcoming, weekStart, weekTotals, whenText } from "./plan.ts";
import { barPct, coursesSections, hm } from "./panelLogic.ts";

const base = () => upsert(EMPTY, { id: "a", name: "Networking", provider: "Uni", url: "javascript:x", total: 10, done: 3 }, 1);

describe("courses state", () => {
  it("cleans bad data", () => {
    assert.deepEqual(parseState("nope"), EMPTY);
    const s = parseState(JSON.stringify({ courses: [{ name: "X", total: 5, done: 9, dates: [{ date: "bad" }], log: [{ date: "2026-01-01", mins: -3 }] }, { name: "" }], imported: true }));
    assert.equal(s.courses.length, 1);
    assert.equal(s.courses[0].done, 5);
    assert.deepEqual(s.courses[0].dates, []);
    assert.deepEqual(s.courses[0].log, []);
    assert.equal(s.imported, true);
  });
  it("upsert, step, dates, log, remove", () => {
    let s = base();
    assert.equal(s.courses[0].url, "");
    s = step(step(s, "a", 1), "a", 100);
    assert.equal(s.courses[0].done, 10);
    assert.equal(pct(s.courses[0]), 100);
    s = addDate(addDate(s, "a", { label: "Final", date: "2026-12-10", kind: "exam" }), "a", { label: "Essay", date: "2026-11-02", kind: "due" });
    assert.deepEqual(s.courses[0].dates.map((d) => d.label), ["Essay", "Final"]);
    s = removeDate(s, "a", 0);
    s = logTime(s, "a", "2026-10-30", 45);
    assert.equal(s.courses[0].log[0].mins, 45);
    assert.throws(() => upsert(s, { name: " " }, 2));
    assert.throws(() => addDate(s, "a", { label: "x", date: "", kind: "due" }));
    assert.equal(remove(s, "a").courses.length, 0);
  });
});

describe("courses views", () => {
  it("weeks start on Monday and totals land in the right week", () => {
    assert.equal(weekStart("2026-10-30"), "2026-10-26");
    let s = base();
    s = logTime(logTime(s, "a", "2026-10-26", 30), "a", "2026-10-20", 20);
    const w = weekTotals(s.courses, "2026-10-30", 3);
    assert.deepEqual(w, [{ week: "2026-10-12", mins: 0 }, { week: "2026-10-19", mins: 20 }, { week: "2026-10-26", mins: 30 }]);
  });
  it("upcoming dates within the window, soonest first", () => {
    let s = base();
    s = addDate(addDate(addDate(s, "a", { label: "Old", date: "2026-10-01", kind: "due" }), "a", { label: "Exam", date: "2026-11-05", kind: "exam" }), "a", { label: "Soon", date: "2026-10-31", kind: "due" });
    assert.deepEqual(upcoming(s.courses, "2026-10-30", 7).map((u) => [u.label, u.inDays]), [["Soon", 1], ["Exam", 6]]);
    assert.equal(whenText(0), "today");
    assert.deepEqual(calendarArgs(s.courses[0], s.courses[0].dates[2]), { title: "Exam: Exam (Networking)", day: "2026-11-05", notes: "Uni" });
  });
  it("sorts and hides finished courses", () => {
    let s = upsert(base(), { id: "b", name: "Algebra", total: 4, done: 4 }, 2);
    assert.deepEqual(sortCourses(s.courses, "name", true, "2026-10-30").map((c) => c.id), ["b", "a"]);
    assert.deepEqual(sortCourses(s.courses, "progress", false, "2026-10-30").map((c) => c.id), ["a"]);
    s = addDate(s, "b", { label: "x", date: "2026-11-01", kind: "due" });
    assert.deepEqual(sortCourses(s.courses, "date", true, "2026-10-30").map((c) => c.id), ["b", "a"]);
  });
  it("imports the Lab hub courses once, skipping duplicates", () => {
    const hub = JSON.stringify({ courses: [{ name: "networking", total: 5, done: 2 }, { name: "Linux basics", total: 8, done: 1 }] });
    const s = importLab(base(), hub, 5);
    assert.deepEqual(s.courses.map((c) => c.name), ["Networking", "Linux basics"]);
    assert.equal(s.imported, true);
    assert.equal(importLab(s, hub, 6), s);
    assert.equal(importLab(EMPTY, "garbage", 1).imported, true);
  });
  it("bars and hours", () => {
    assert.equal(barPct(90, 180, 90), 50);
    assert.equal(barPct(300, 180, 300), 100);
    assert.equal(barPct(0, 0, 0), 0);
    assert.equal(hm(150), "2 h 30 min");
    assert.equal(hm(60), "1 h");
  });
  it("manifest sections match the Section ids in Panel.tsx", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(used, coursesSections.map((s) => s.id).sort());
  });
});

import { FREE_COURSES } from "./freeCourses.ts";
import { seedFree, sortCourses as sortC } from "./plan.ts";
import { parseState as ps } from "./logic.ts";
it("free courses are added once, in order, skipping names already present", () => {
  const s0 = ps(JSON.stringify({ courses: [{ id: "a", name: "2. Introduction to Cybersecurity", total: 6 }], imported: true }));
  const s1 = seedFree(s0, FREE_COURSES, 1);
  assert.equal(s1.courses.length, FREE_COURSES.length);
  assert.equal(s1.seeded, true);
  assert.equal(seedFree(s1, FREE_COURSES, 2).courses.length, FREE_COURSES.length);
  assert.ok(FREE_COURSES.every((c, i) => c.name.startsWith(`${i + 1}.`) && /^https:\/\//.test(c.url)));
  assert.deepEqual(sortC(s1.courses, "order", true, "2026-01-01").map((c) => c.id), s1.courses.map((c) => c.id));
});
