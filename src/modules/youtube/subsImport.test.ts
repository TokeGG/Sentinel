import { test } from "node:test";
import assert from "node:assert/strict";
import { newIds, parseSubsPage, subsUrl } from "./subsImport.ts";

const id = "UC" + "a".repeat(22);
test("parseSubsPage keeps valid channel ids and the next token", () => {
  const p = parseSubsPage({ items: [{ snippet: { resourceId: { channelId: id } } }, { snippet: { resourceId: { channelId: "bad" } } }, {}], nextPageToken: "N" });
  assert.deepEqual(p, { ids: [id], next: "N" });
  assert.deepEqual(parseSubsPage(null), { ids: [], next: null });
});
test("subsUrl adds the page token; newIds drops known and duplicates", () => {
  assert.match(subsUrl("a b"), /mine=true.*pageToken=a%20b$/);
  assert.ok(!subsUrl(null).includes("pageToken"));
  assert.deepEqual(newIds([id, id, "UCx"], new Set(["UCx"])), [id]);
});
