import { it } from "node:test";
import assert from "node:assert/strict";
import { applyFeedPrefs, inQuiet, noteBody } from "./feedPrefs.ts";

it("quiet hours wrap past midnight", () => {
  assert.equal(inQuiet(23, 22, 7), true);
  assert.equal(inQuiet(3, 22, 7), true);
  assert.equal(inQuiet(12, 22, 7), false);
  assert.equal(inQuiet(10, 9, 17), true);
  assert.equal(inQuiet(17, 9, 17), false);
  assert.equal(inQuiet(5, 5, 5), false);
});
it("filters by length and reposts", () => {
  const ps = [{ text: "hi", meta: {} }, { text: "a longer post", meta: { repost: true } }, { text: "medium!", meta: {} }];
  assert.deepEqual(applyFeedPrefs(ps, { minLen: 3, maxLen: 0, hideReposts: false }).map((p) => p.text), ["a longer post", "medium!"]);
  assert.deepEqual(applyFeedPrefs(ps, { minLen: 0, maxLen: 8, hideReposts: true }).map((p) => p.text), ["hi", "medium!"]);
  assert.equal(applyFeedPrefs(ps, { minLen: 0, maxLen: 0, hideReposts: false }).length, 3);
});
it("builds a note body", () => {
  assert.equal(noteBody({ name: "Ann", handle: "@ann", text: " Hello ", link: "https://x.y/1", platform: "mastodon" }), "Ann (@ann, mastodon):\nHello\nhttps://x.y/1");
});
