import test from "node:test";
import assert from "node:assert/strict";
import { describeUpdate } from "./updater.ts";

test("describeUpdate trims notes and tolerates a missing body", () => {
  assert.deepEqual(describeUpdate({ version: "0.1.2", body: "  fixes\n" }), { version: "0.1.2", notes: "fixes" });
  assert.deepEqual(describeUpdate({ version: "0.1.2" }), { version: "0.1.2", notes: "" });
  assert.deepEqual(describeUpdate({ version: "0.1.2", body: null }), { version: "0.1.2", notes: "" });
});
