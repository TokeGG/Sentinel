import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAlert, digestDue, isPriority, pruneHour, sanitizePolicy, toastText, urgencyColor } from "../notifPolicy.ts";
import { filterLog } from "../notifSearch.ts";
import { expandAt, filterClips, rowsToMarkdown, triggerOf } from "./textTools.ts";
import { cleanTemplates, cleanZones, countdown, templateItem, zoneTimes } from "../../modules/calendar/timeExtras.ts";

test("notif policy: sanitize + decisions", () => {
  const p = sanitizePolicy({ sounds: { "hub.a": "chime", "hub.b": "loud" }, prioritySenders: [" Boss@X.com "], hourlyLimit: 2 });
  assert.deepEqual(p.sounds, { "hub.a": "chime" });
  assert.ok(isPriority(p, "boss@x.com", "hi"));
  assert.ok(!isPriority(p, "other", "hi"));
  const now = 1_000_000;
  assert.equal(decideAlert(p, ["hub.a"], now, 0), "toast");
  assert.equal(decideAlert(p, ["hub.a"], now, 2), "drop");
  assert.equal(decideAlert(p, ["hub.a"], now, 2, true), "toast");
  assert.equal(decideAlert({ ...p, vacationUntil: now + 1 }, ["hub.a"], now, 0), "drop");
  assert.equal(decideAlert({ ...p, focus: { until: now + 1, allow: ["hub.a"] } }, ["hub.a"], now, 0), "toast");
  assert.equal(decideAlert({ ...p, focus: { until: now + 1, allow: ["hub.a"] } }, ["hub.b"], now, 0), "drop");
  assert.equal(decideAlert({ ...p, digest: { on: true, at: 0 } }, ["hub.a"], now, 0), "digest");
  assert.deepEqual(pruneHour([now - 3_700_000, now - 10], now), [now - 10]);
});

test("digest timing, toast text, urgency", () => {
  const p = sanitizePolicy({ digest: { on: true, at: 18 * 60 } });
  const at6pm = new Date(2026, 0, 1, 18, 0).getTime();
  assert.ok(!digestDue(p, new Date(2026, 0, 1, 17, 0), 0));
  assert.ok(digestDue(p, new Date(2026, 0, 1, 19, 0), 0));
  assert.ok(!digestDue(p, new Date(2026, 0, 1, 19, 0), at6pm + 1));
  assert.equal(toastText(p, 2, 5, ["Mail"]), "2 new notifications (5 unread)");
  assert.match(toastText({ ...p, lockCountOnly: false }, 1, 1, ["Mail"]), /Mail$/);
  assert.equal(urgencyColor(1), "var(--accent)");
  assert.equal(urgencyColor(6), "var(--warn)");
  assert.equal(urgencyColor(1, true), "var(--bad)");
  assert.deepEqual(filterLog([{ at: "Oct 3", name: "Mail" }, { at: "Oct 4", name: "News" }], "mail"), [{ at: "Oct 3", name: "Mail" }]);
});

test("text tools: clips, snippets, markdown", () => {
  assert.deepEqual(filterClips([{ id: 1, content: "Hello World" }, { id: 2, content: "bye" }], "world hello").map((c) => c.id), [1]);
  assert.equal(triggerOf("My Sig"), ";mysig");
  const r = expandAt("Thanks ;mysig", 13, [{ title: "My Sig", body: "-- Me" }]);
  assert.deepEqual(r, { text: "Thanks -- Me", caret: 12 });
  assert.equal(expandAt("no trigger", 10, []), null);
  assert.equal(rowsToMarkdown("X", [{ title: "A", link: "https://a" }, { title: "B|c" }]), "# X\n\n- [A](https://a)\n- B\\|c\n");
  assert.match(rowsToMarkdown("T", [{ id: 1, body: "x" }]), /\| id \| body \|\n\| --- \| --- \|\n\| 1 \| x \|/);
  assert.match(rowsToMarkdown("E", []), /No rows/);
});

test("calendar extras: zones, countdown, templates", () => {
  assert.deepEqual(cleanZones(["UTC", "Not/AZone", "UTC"]), ["UTC"]);
  assert.match(zoneTimes(new Date(Date.UTC(2026, 0, 1, 12, 5)), ["UTC"])[0].time, /12:05/);
  assert.equal(countdown(1000 + 3 * 86400_000 + 4 * 3600_000, 1000), "3d 4h");
  assert.equal(countdown(125 * 60_000, 0), "2h 05m");
  assert.equal(countdown(0, 120_000), "passed");
  assert.equal(countdown(30_000, 0), "now");
  const t = cleanTemplates([{ name: "Bins", title: "Take out bins", repeat: "weekly" }, { name: "x", title: "y", repeat: "yearly" }]);
  assert.equal(t.length, 1);
  assert.deepEqual(templateItem(t[0], new Date(2026, 1, 3)), { kind: "task", title: "Take out bins", day: "2026-02-03", repeat: "weekly" });
});
