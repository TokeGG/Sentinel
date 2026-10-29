import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyClear, badgeLabel, chatOptions, chatSections, clock, isAtBottom, isMention, moved, pushCapped, toRooms, visibleRooms, webPanelRef } from "./panelLogic.ts";
import { customizeError } from "../../core/customizeChecks.ts";
import type { Incoming, Room } from "./types.ts";

const inc = (user: string, text = "x"): Incoming => ({ user, text, time: 0, kind: "chat" });
const room = (id: string, pinned = false): Room => ({ id, site: "twitch", target: id, label: id, position: 0, pinned });

test("pushCapped keeps newest cap and assigns increasing ids", () => {
  let l = pushCapped([], [inc("a"), inc("b"), inc("c")], 0, 3);
  l = pushCapped(l, [inc("d"), inc("e")], 3, 3);
  assert.deepEqual(l.map((m) => m.user), ["c", "d", "e"]);
  assert.deepEqual(l.map((m) => m.id), ["2", "3", "4"]);
});
test("applyClear strikes one user or everything, not notices", () => {
  const l = pushCapped([], [inc("Bob"), inc("al"), { ...inc(""), kind: "notice" }], 0, 10);
  assert.deepEqual(applyClear(l, "bob").map((m) => !!m.deleted), [true, false, false]);
  assert.deepEqual(applyClear(l).map((m) => !!m.deleted), [true, true, false]);
});
test("isMention: whole word, @, case-insensitive, regex-safe", () => {
  assert.equal(isMention("hey @Bob!", "bob"), true);
  assert.equal(isMention("bob: hi", "Bob"), true);
  assert.equal(isMention("bobby", "bob"), false);
  assert.equal(isMention("anything", undefined), false);
  assert.equal(isMention("a.b", "a.b"), true);
  assert.equal(isMention("axb", "a.b"), false);
});
test("isAtBottom", () => {
  assert.equal(isAtBottom(960, 40, 1000), true);
  assert.equal(isAtBottom(500, 40, 1000), false);
  assert.equal(isAtBottom(0, 100, 100), true);
});
test("visibleRooms: tabs=active, columns=pinned or all", () => {
  const rs = [room("a"), room("b", true), room("c")];
  assert.deepEqual(visibleRooms(rs, "tabs", "c").map((r) => r.id), ["c"]);
  assert.deepEqual(visibleRooms(rs, "columns", "a").map((r) => r.id), ["b"]);
  assert.deepEqual(visibleRooms([room("a"), room("b")], "columns", "a").map((r) => r.id), ["a", "b"]);
});
test("moved swaps neighbours, stops at the ends", () => {
  assert.deepEqual(moved(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moved(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
  assert.deepEqual(moved(["a"], "zz", 1), ["a"]);
});
test("toRooms maps db rows", () => {
  assert.deepEqual(toRooms([{ id: "t:x", site: "twitch", target: "x", label: "x", position: 2, pinned: 1 }])[0], { id: "t:x", site: "twitch", target: "x", label: "x", position: 2, pinned: true });
});
test("webPanelRef yields a valid, stable panel id and profile", () => {
  const r = webPanelRef("https://www.icanhazchat.com/some/room");
  assert.match(r.id, /^hub\.chat\.web-[0-9a-f]+$/);
  assert.ok(r.id.length <= 64);
  assert.match(r.profile, /^[a-z0-9][a-z0-9-]{0,31}$/);
  assert.deepEqual(webPanelRef("https://www.icanhazchat.com/some/room"), r);
  assert.notEqual(webPanelRef("https://www.icanhazchat.com/other").id, r.id);
  assert.match(webPanelRef("https://a-very-long-subdomain.of-some-extremely-long-hostname-example.com/").profile, /^[a-z0-9][a-z0-9-]{0,31}$/);
});
test("badges and clock", () => {
  assert.equal(badgeLabel("moderator"), "MOD");
  assert.equal(badgeLabel("flair9"), "");
  assert.match(clock(Date.now()), /^\d\d:\d\d$/);
});
test("customize declaration is valid and Panel.tsx sections match it", () => {
  assert.equal(customizeError({ sections: chatSections, options: chatOptions }), null);
  const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
  const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(used, chatSections.map((x) => x.id).sort());
});
