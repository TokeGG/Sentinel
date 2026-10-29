import test from "node:test";
import assert from "node:assert/strict";
import { makeLatest } from "./make-latest-json.mjs";

const base = { tag: "v0.1.2", exeName: "Sentinel_0.1.2_x64-setup.exe", signature: "sig\n", repo: "TokeGG/Sentinel" };

test("builds a windows manifest from the tag", () => {
  const j = makeLatest({ ...base, now: new Date("2026-10-29T00:00:00Z") });
  assert.equal(j.version, "0.1.2");
  assert.equal(j.pub_date, "2026-10-29T00:00:00.000Z");
  assert.deepEqual(j.platforms["windows-x86_64"], {
    signature: "sig",
    url: "https://github.com/TokeGG/Sentinel/releases/download/v0.1.2/Sentinel_0.1.2_x64-setup.exe",
  });
});
test("rejects tags without the v prefix and empty signatures", () => {
  assert.throws(() => makeLatest({ ...base, tag: "0.1.2" }), /v0\.1\.1|must look like/);
  assert.throws(() => makeLatest({ ...base, signature: " " }), /empty signature/);
});
