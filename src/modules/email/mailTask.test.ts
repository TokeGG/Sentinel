import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mailTaskArgs } from "./mailTask.ts";

describe("mailTaskArgs", () => {
  it("builds a task for today", () => {
    assert.deepEqual(mailTaskArgs({ subject: " ", fromAddr: "a@b" }, new Date(2026, 0, 5)), { kind: "task", title: "Email: (no subject)", day: "2026-01-05", notes: "From a@b" });
  });
});
