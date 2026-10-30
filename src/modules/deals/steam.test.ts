import { test } from "node:test";
import assert from "node:assert/strict";
import { newWishes, parseAppName, parseProfileXml, parseWishlist, steamTarget } from "./steam.ts";
import { dealCalendarItem } from "./toCalendar.ts";

test("steam target from id, url or vanity", () => {
  assert.deepEqual(steamTarget("76561197960287930"), { id: "76561197960287930" });
  assert.deepEqual(steamTarget("https://steamcommunity.com/profiles/76561197960287930/"), { id: "76561197960287930" });
  assert.deepEqual(steamTarget("https://steamcommunity.com/id/gabe"), { vanity: "gabe" });
  assert.deepEqual(steamTarget("gabe"), { vanity: "gabe" });
  assert.equal(steamTarget("no spaces please"), null);
});

test("steam parsers", () => {
  assert.equal(parseProfileXml("<profile><steamID64>76561197960287930</steamID64></profile>"), "76561197960287930");
  assert.equal(parseProfileXml("<response><error>x</error></response>"), null);
  assert.deepEqual(parseWishlist({ response: { items: [{ appid: 10 }, { appid: "20" }, { appid: 10 }, {}] } }), [10, 20]);
  assert.deepEqual(parseWishlist({}), []);
  assert.equal(parseAppName({ "10": { success: true, data: { name: " Half-Life " } } }, 10), "Half-Life");
  assert.equal(parseAppName({ "10": { success: false } }, 10), null);
  assert.deepEqual(newWishes(["Half-Life", "Portal"], ["half-life"]), ["Portal"]);
});

test("deal -> calendar item carries the link", () => {
  const it = dealCalendarItem({ title: "RTX 4070 $499", link: "https://x.test/d" }, new Date("2026-10-30T10:00:00Z"));
  assert.deepEqual(it, { kind: "task", title: "Deal: RTX 4070 $499", day: "2026-10-30", url: "https://x.test/d", notes: "From Deals" });
  assert.equal(dealCalendarItem({ title: "x", link: "javascript:alert(1)" }, new Date()).url, "");
});
