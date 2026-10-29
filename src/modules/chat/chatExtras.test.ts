import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, insertEmote, overCap, pickEmotes, playerEmbed, toFilters, userKey } from "./chatExtras.ts";

test("classify: ignore, word filter, highlight, notices", () => {
  const f = toFilters([{ kind: "ignore", value: "Spammer" }, { kind: "word", value: "spoiler" }, { kind: "highlight", value: "giveaway" }]);
  assert.equal(classify({ user: "spammer", text: "hi", kind: "chat" }, f), "hide");
  assert.equal(classify({ user: "a", text: "big SPOILER here", kind: "chat" }, f), "hide");
  assert.equal(classify({ user: "a", text: "spoilers", kind: "chat" }, f), "show");
  assert.equal(classify({ user: "a", text: "Giveaway now!", kind: "action" }, f), "highlight");
  assert.equal(classify({ user: "spammer", text: "x", kind: "notice" }, f), "show");
});

test("userKey is case-insensitive per site", () => assert.equal(userKey("twitch", "Bob"), "twitch:bob"));

test("pickEmotes ranks prefix matches first", () => {
  const set = new Map([["KEKW", { url: "k" }], ["OMEGALUL", { url: "o" }], ["LULW", { url: "l" }]]);
  assert.deepEqual(pickEmotes(set, "lul").map((e) => e.name), ["LULW", "OMEGALUL"]);
  assert.equal(pickEmotes(set, "", 2).length, 2);
  assert.equal(insertEmote("hi  ", "KEKW"), "hi KEKW ");
  assert.equal(insertEmote("", "KEKW"), "KEKW ");
});

test("playerEmbed for twitch and kick only, with parent host", () => {
  assert.equal(playerEmbed("twitch", "Shroud", "tauri.localhost"), "https://player.twitch.tv/?channel=shroud&parent=tauri.localhost&muted=true");
  assert.equal(playerEmbed("kick", "xqc@12345", ""), "https://player.kick.com/xqc?muted=true");
  assert.equal(playerEmbed("dgg", "x", "h"), null);
  assert.equal(playerEmbed("twitch", "bad/../x", "h"), null);
});

test("overCap", () => { assert.equal(overCap(1200, 1000), 200); assert.equal(overCap(10, 1000), 0); });
