import { test } from "node:test";
import assert from "node:assert/strict";
import { dggEvent, dggMessage, parseFrame } from "./dggParse.ts";

test("parseFrame splits command and json", () => {
  const f = parseFrame('MSG {"nick":"a","features":["subscriber","flair9"],"timestamp":1700000000000,"data":"hello"}');
  assert.equal(f.cmd, "MSG");
  assert.equal(f.data?.nick, "a");
  assert.deepEqual(parseFrame("PING"), { cmd: "PING", data: null });
  assert.deepEqual(parseFrame("MSG {bad"), { cmd: "MSG", data: null });
});
test("dggMessage: MSG with known badges only, /me, BROADCAST", () => {
  const m = dggMessage("MSG", { nick: "a", features: ["subscriber", "flair9"], timestamp: 5, data: "hello" })!;
  assert.deepEqual([m.user, m.text, m.time, m.kind, m.badges], ["a", "hello", 5, "chat", ["subscriber"]]);
  assert.equal(dggMessage("MSG", { nick: "a", data: "/me waves" })!.kind, "action");
  assert.equal(dggMessage("MSG", { nick: "a", data: "/me waves" })!.text, "waves");
  assert.equal(dggMessage("BROADCAST", { data: "hi all" })!.kind, "notice");
  assert.equal(dggMessage("JOIN", { nick: "a" }), null);
  assert.equal(dggMessage("MSG", { nick: "a" }), null);
});
test("dggEvent classifies frames", () => {
  assert.equal(dggEvent('MSG {"nick":"a","data":"hi","timestamp":1}').kind, "message");
  assert.equal(dggEvent('PING {"timestamp":1}').kind, "ping");
  assert.equal(dggEvent("PING").kind, "ping");
  assert.deepEqual(dggEvent('ERR {"description":"needlogin"}'), { kind: "error", text: "needlogin" });
  assert.deepEqual(dggEvent('ERR "banned"'), { kind: "error", text: "banned" });
  assert.deepEqual(dggEvent("ERR needlogin"), { kind: "error", text: "needlogin" });
  assert.deepEqual(dggEvent('MUTE {"nick":"m","data":"bob"}'), { kind: "clear", user: "bob" });
  assert.deepEqual(dggEvent('BAN {"data":"bob"}'), { kind: "clear", user: "bob" });
  assert.deepEqual(dggEvent('BROADCAST {"data":"hey"}').kind, "message");
  for (const c of ["NAMES", "JOIN", "QUIT", "REFRESH"]) assert.deepEqual(dggEvent(`${c} {"users":[]}`), { kind: "ignore", cmd: c });
  for (const bad of ["", "{}", "hello world", "MSG {bad", 'MSG {"nick":"a"}']) assert.equal(dggEvent(bad).kind, "drop");
});
