import { test } from "node:test";
import assert from "node:assert/strict";
import { type Fetch, KICK_HEADERS, resolveChatroom, splitKickTarget, withKickId } from "./kickLookup.ts";

const res = (status: number, body: unknown) => ({ status, ok: status < 400, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

test("sends browser-like headers", () => {
  assert.equal(KICK_HEADERS.Referer, "https://kick.com/");
  assert.match(KICK_HEADERS["User-Agent"], /Mozilla/);
});
test("falls back v2 403 -> v1 200", async () => {
  const urls: string[] = [];
  const f: Fetch = async (u) => (urls.push(u), urls.length === 1 ? res(403, "<html>Just a moment...</html>") : res(200, { chatroom: { id: 99 } }));
  const logs: string[] = [];
  assert.equal(await resolveChatroom("bob", f, (m) => logs.push(m)), 99);
  assert.deepEqual(urls, ["https://kick.com/api/v2/channels/bob", "https://kick.com/api/v1/channels/bob"]);
  assert.ok(logs.some((l) => l.includes("HTTP 403") && l.includes("Just a moment")));
});
test("third endpoint (/chatroom) returns the id directly; thrown fetch is survived", async () => {
  let n = 0;
  const f: Fetch = async () => {
    if (++n === 1) throw new Error("net down");
    return n === 2 ? res(403, "") : res(200, { id: 7 });
  };
  assert.equal(await resolveChatroom("bob", f, () => {}), 7);
});
test("all fail -> descriptive error; 404 first is definitive", async () => {
  await assert.rejects(resolveChatroom("bob", async () => res(403, ""), () => {}), /v2 HTTP 403, v1 HTTP 403, v2\/chatroom HTTP 403.*embed/s);
  let calls = 0;
  await assert.rejects(resolveChatroom("bob", async () => (calls++, res(404, "")), () => {}), /not found/);
  assert.equal(calls, 1);
});
test("manual chatroom id skips the lookup", async () => {
  const f: Fetch = async () => assert.fail("no fetch");
  assert.equal(await resolveChatroom("bob", f, () => {}, 1234), 1234);
});
test("target with manual id", () => {
  const ref = withKickId({ site: "kick", target: "bob", label: "bob" }, " 555 ");
  assert.equal(ref.target, "bob@555");
  assert.deepEqual(splitKickTarget(ref.target), { slug: "bob", chatroom: 555 });
  assert.deepEqual(splitKickTarget("bob"), { slug: "bob" });
  assert.equal(withKickId({ site: "kick", target: "bob", label: "b" }, "abc").target, "bob");
  assert.equal(withKickId({ site: "twitch", target: "bob", label: "b" }, "5").target, "bob");
});
