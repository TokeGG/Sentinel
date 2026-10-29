import test from "node:test";
import assert from "node:assert/strict";
import { keepKnown } from "./restoreLogic.ts";

test("saved layouts for removed modules are ignored, known ones kept in order", () => {
  const rows = [{ module_id: "hub.x" }, { module_id: "hub.notes" }, { module_id: "hub.facebook" }, { module_id: "hub.social" }];
  assert.deepEqual(keepKnown(rows, ["hub.notes", "hub.social"]).map((r) => r.module_id), ["hub.notes", "hub.social"]);
  assert.deepEqual(keepKnown(rows, []), []);
});
