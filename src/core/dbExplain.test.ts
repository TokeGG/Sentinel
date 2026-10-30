import { test } from "node:test";
import assert from "node:assert/strict";
import { describeRepair, explainLoadProblem } from "./dbExplain.ts";

test("explainLoadProblem names the cause in plain words", () => {
  assert.match(explainLoadProblem(null), /normally/);
  assert.match(explainLoadProblem("migration 17 was previously applied but has been modified"), /update 17 was changed/);
  assert.match(explainLoadProblem("VersionMismatch(18)"), /update 18/);
  assert.match(explainLoadProblem("migration 49 was previously applied but is missing in the resolved migrations"), /newer or test build/);
  assert.match(explainLoadProblem("Dirty(3)"), /half way/);
  assert.match(explainLoadProblem("disk I/O error"), /disk I\/O error/);
});

test("describeRepair", () => {
  assert.equal(describeRepair(null), "");
  assert.match(describeRepair({ fixes: [], backup: null, error: null }), /Nothing to repair/);
  assert.match(describeRepair({ fixes: [{ Checksum: 17 }, { DropUnknown: 49 }], backup: "b.bak", error: null }), /re-stamped 17, forgot unknown 49\)\. Backup: b\.bak\. Restart/);
  assert.match(describeRepair({ fixes: [], backup: null, error: "locked" }), /failed: locked/);
});
