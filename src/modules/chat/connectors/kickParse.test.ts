import { test } from "node:test";
import assert from "node:assert/strict";
import { chatroomId, KICK_MESSAGE_EVENT, kickEmotes, kickMessage, pusherData } from "./kickParse.ts";

test("kickEmotes: replaces [emote:ID:name] with ranges (code points)", () => {
  const r = kickEmotes("hi 😀 [emote:37226:KEKW] and [emote:1:a]!");
  assert.equal(r.text, "hi 😀 KEKW and a!");
  assert.deepEqual(r.native.map((e) => [e.name, e.start, e.end]), [["KEKW", 5, 8], ["a", 14, 14]]);
  assert.match(r.native[0].url, /files\.kick\.com\/emotes\/37226\//);
  assert.deepEqual(Array.from(r.text).slice(5, 9).join(""), "KEKW");
});
test("kickEmotes: plain text untouched", () => {
  assert.deepEqual(kickEmotes("hello"), { text: "hello", native: [] });
});
test("pusherData unwraps double-encoded data and tolerates junk", () => {
  const inner = { content: "x" };
  const e = pusherData(JSON.stringify({ event: KICK_MESSAGE_EVENT, data: JSON.stringify(inner) }))!;
  assert.equal(e.event, KICK_MESSAGE_EVENT);
  assert.deepEqual(e.data, inner);
  assert.equal(pusherData("nope"), null);
  assert.equal(pusherData('{"x":1}'), null);
  assert.equal(pusherData('{"event":"pusher:ping","data":{}}')!.event, "pusher:ping");
});
test("kickMessage maps sender, colour, badges, time", () => {
  const m = kickMessage({
    id: "1", content: "yo [emote:5:LUL]", created_at: "2026-10-01T10:00:00Z",
    sender: { username: "Bob", slug: "bob", identity: { color: "#DEB2FF", badges: [{ type: "moderator", text: "Moderator" }] } },
  })!;
  assert.equal(m.user, "Bob");
  assert.equal(m.text, "yo LUL");
  assert.equal(m.color, "#DEB2FF");
  assert.deepEqual(m.badges, ["moderator"]);
  assert.equal(m.time, Date.parse("2026-10-01T10:00:00Z"));
  assert.equal(m.native![0].start, 3);
});
test("kickMessage rejects malformed payloads", () => {
  assert.equal(kickMessage({ content: "x" }), null);
  assert.equal(kickMessage({ sender: {}, content: 5 }), null);
  assert.equal(kickMessage({ sender: { username: "a", identity: { color: "red" } }, content: "x" })!.color, undefined);
});
test("chatroomId", () => {
  assert.equal(chatroomId({ id: 1, chatroom: { id: 777 } }), 777);
  assert.equal(chatroomId({ chatroom: {} }), null);
  assert.equal(chatroomId(null), null);
});
