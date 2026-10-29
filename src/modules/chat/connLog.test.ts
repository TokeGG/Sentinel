import { test } from "node:test";
import assert from "node:assert/strict";
import { backoffMs, closeHint, createLog, dropCounter, excerpt, redact } from "./connLog.ts";

test("ring buffer keeps the newest entries and formats timestamps", () => {
  let t = Date.UTC(2026, 0, 1, 10, 0, 0);
  const l = createLog(3, () => t++);
  for (const m of ["a", "b", "c", "d"]) l.add(m);
  assert.deepEqual(l.entries().map((e) => e.msg), ["b", "c", "d"]);
  assert.match(l.text().split("\n")[0], /^10:00:00\.001 b$/);
});
test("redact removes tokens; excerpt strips tags and truncates", () => {
  assert.equal(redact("PASS oauth:abc123def"), "PASS oauth:***");
  assert.ok(!redact("Authorization: Bearer xyz.123").includes("xyz"));
  assert.equal(redact('{"token":"s3cret","a":1}'), '{"token":"***","a":1}');
  assert.equal(excerpt("<html><b>Just a   moment</b></html>"), "Just a moment");
  assert.equal(excerpt("x".repeat(500)).length, 120);
  const l = createLog();
  l.add("oauth:topsecret");
  assert.ok(!l.text().includes("topsecret"));
});
test("backoff doubles and is capped", () => {
  assert.deepEqual([0, 1, 2, 3].map(backoffMs), [1000, 2000, 4000, 8000]);
  assert.equal(backoffMs(20), 30_000);
});
test("closeHint and dropCounter", () => {
  assert.match(closeHint(1006), /abnormal/);
  assert.equal(closeHint(1000), "normal close");
  const out: string[] = [];
  const d = dropCounter((m) => out.push(m));
  for (let i = 0; i < 205; i++) d();
  assert.equal(out.length, 3);
});
