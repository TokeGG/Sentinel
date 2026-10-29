process.env.TZ = "America/New_York";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calendarSections, overdueText, timeText } from "./panelLogic.ts";
import { agendaRows, previewQuick, quickArgs, taskTree, whenText } from "./taskLogic.ts";
import { parseQuick } from "./quickParse.ts";
import { toFields } from "./itemInput.ts";

const now = new Date(2026, 9, 29, 10, 0);

test("agendaRows hides done tasks", () => {
  assert.deepEqual(agendaRows([{ id: 1 }, { id: 2, done: true }]).map((r) => r.id), [1]);
});

test("taskTree orders open by due, undated last, done at the bottom, and nests subtasks", () => {
  const rows = [
    { kind: "task", itemId: 1, due: "2026-11-02T05:00:00.000Z", title: "b" },
    { kind: "task", itemId: 2, title: "undated" },
    { kind: "task", itemId: 3, due: "2026-10-30T05:00:00.000Z", title: "a" },
    { kind: "task", itemId: 4, done: true, due: "2026-10-01T05:00:00.000Z" },
    { kind: "task", itemId: 5, parentId: 3, title: "sub" },
    { kind: "event", itemId: 9 },
  ];
  const t = taskTree(rows);
  assert.deepEqual(t.map((n) => n.task.itemId), [3, 1, 2, 4]);
  assert.deepEqual(t[0].subs.map((s) => s.itemId), [5]);
});

test("whenText / timeText / overdueText for own rows", () => {
  const timed = { due: new Date(2026, 9, 30, 13, 0).toISOString(), rrule: "FREQ=WEEKLY" };
  assert.equal(whenText(timed, now), "Tomorrow · 13:00 · repeats weekly");
  assert.equal(whenText({ due: new Date(2026, 9, 30).toISOString(), allDay: true }, now), "Tomorrow");
  assert.equal(whenText({}, now), "No date");
  assert.equal(timeText({ allDay: true, due: new Date(2026, 9, 30).toISOString() }), "all day");
  assert.equal(overdueText({ kind: "task", due: new Date(2026, 9, 27, 9).toISOString() }, now), "task due Tuesday, Oct 27");
});

test("previewQuick and quickArgs feed add_item through toFields", () => {
  const q = parseQuick("lunch friday 1pm every week", now);
  assert.equal(previewQuick(q), "Event · Oct 30 · 13:00 · repeats weekly");
  const f = toFields(quickArgs(q));
  assert.deepEqual([f.kind, f.title, f.startsAt, f.rrule], ["event", "lunch", "2026-10-30T13:00", "FREQ=WEEKLY"]);
  const t = toFields(quickArgs(parseQuick("buy milk", now)));
  assert.deepEqual([t.kind, t.startsAt], ["task", null]);
});

test("section ids: new ones declared, and every <Section id> in the panel files is declared", () => {
  assert.deepEqual(calendarSections.map((s) => s.id), ["add", "overdue", "today", "week", "tasks", "ics", "views", "reminders", "habits", "focus", "contacts", "money", "bookmarks"]);
  const src = ["Panel.tsx"].map((f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8")).join("");
  const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(used, calendarSections.map((s) => s.id).sort());
});
