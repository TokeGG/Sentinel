import { test } from "node:test";
import assert from "node:assert/strict";
import { toFields } from "./itemInput.ts";

test("add_item url is kept in notes (http(s) only, not duplicated)", () => {
  assert.equal(toFields({ kind: "task", title: "Deal", url: "https://x.test/a" }).notes, "https://x.test/a");
  assert.equal(toFields({ kind: "task", title: "Deal", notes: "hi", url: "https://x.test/a" }).notes, "hi\nhttps://x.test/a");
  assert.equal(toFields({ kind: "task", title: "Deal", notes: "https://x.test/a", url: "https://x.test/a" }).notes, "https://x.test/a");
  assert.equal(toFields({ kind: "task", title: "Deal", url: "javascript:x" }).notes, "");
});
