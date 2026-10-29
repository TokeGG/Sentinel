import { test } from "node:test";
import assert from "node:assert/strict";
import { kickFrame } from "./kickFrames.ts";
import { KICK_MESSAGE_EVENT, KICK_WS } from "./kickParse.ts";

const CH = "chatrooms.42.v2";
const frame = (event: string, data: unknown) => JSON.stringify({ event, data: JSON.stringify(data) });

test("KICK_WS has the pusher url format", () => {
  assert.match(KICK_WS, /^wss:\/\/ws-[a-z0-9]+\.pusher\.com\/app\/[0-9a-f]+\?protocol=7&client=js&version=8\.4\.0-rc2&flash=false$/);
});
test("connection_established -> subscribe message", () => {
  const a = kickFrame(frame("pusher:connection_established", { socket_id: "1.2", activity_timeout: 120 }), CH);
  assert.deepEqual(JSON.parse(a.send!), { event: "pusher:subscribe", data: { auth: "", channel: CH } });
});
test("ping -> pong, pong ignored, subscription_succeeded logged", () => {
  assert.equal(kickFrame('{"event":"pusher:ping","data":{}}', CH).send, '{"event":"pusher:pong","data":{}}');
  assert.deepEqual(kickFrame('{"event":"pusher:pong","data":{}}', CH), {});
  assert.match(kickFrame('{"event":"pusher_internal:subscription_succeeded","data":"{}"}', CH).log!, /subscription succeeded/);
});
test("pusher:error surfaces as error", () => {
  assert.match(kickFrame(frame("pusher:error", { code: 4001, message: "App key not found" }), CH).error!, /4001/);
});
test("chat message, bad message and junk", () => {
  const ok = kickFrame(frame(KICK_MESSAGE_EVENT, { content: "hi", created_at: "2026-10-01T10:00:00Z", sender: { username: "bob" } }), CH);
  assert.equal(ok.message!.text, "hi");
  assert.equal(kickFrame(frame(KICK_MESSAGE_EVENT, { content: 1 }), CH).drop, true);
  assert.equal(kickFrame("not json", CH).drop, true);
  assert.deepEqual(kickFrame(frame("App\\Events\\Other", {}), CH), {});
});
test("ban event clears the user", () => {
  assert.deepEqual(kickFrame(frame("App\\Events\\UserBannedEvent", { user: { username: "x" } }), CH).clear, { user: "x" });
});
