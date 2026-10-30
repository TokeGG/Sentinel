import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderDue } from "./health.ts";

test("backup reminder off at 0, due after N days or never backed up", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  assert.equal(reminderDue(null, now, 0), false);
  assert.equal(reminderDue(null, now, 7), true);
  assert.equal(reminderDue(new Date("2026-01-05T00:00:00Z"), now, 7), false);
  assert.equal(reminderDue(new Date("2026-01-01T00:00:00Z"), now, 7), true);
});
