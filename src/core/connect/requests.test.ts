import { test } from "node:test";
import assert from "node:assert/strict";
import { codeExchange, deviceGrant, deviceStart, refreshGrant } from "./requests.ts";
import { classifyPoll, nextInterval, parseDeviceStart, prettyCode } from "./deviceLogic.ts";

test("code exchange carries the verifier and client id; secret only when given", () => {
  const r = codeExchange({ url: "https://t/x", clientId: "c" }, "CODE", "http://127.0.0.1:1", "VER");
  const p = new URLSearchParams(r.body);
  assert.equal(p.get("code_verifier"), "VER");
  assert.equal(p.get("client_id"), "c");
  assert.equal(p.has("client_secret"), false);
  assert.equal(new URLSearchParams(codeExchange({ url: "https://t/x", clientId: "c", clientSecret: "s" }, "C", "r").body).get("client_secret"), "s");
});

test("Reddit style: basic auth with empty secret, no client_id in body", () => {
  const r = refreshGrant({ url: "https://t/x", clientId: "abc", basicAuth: true }, "R");
  assert.equal(r.headers.Authorization, `Basic ${btoa("abc:")}`);
  assert.equal(new URLSearchParams(r.body).has("client_id"), false);
});

test("device requests", () => {
  assert.equal(new URLSearchParams(deviceStart("https://d", "c", ["a", "b"]).body).get("scope"), "a b");
  assert.equal(new URLSearchParams(deviceGrant({ url: "u", clientId: "c" }, "DC").body).get("grant_type"), "urn:ietf:params:oauth:grant-type:device_code");
});

test("device start parsing and defaults", () => {
  const d = parseDeviceStart({ device_code: "D", user_code: "ABCD1234", verification_uri: "https://x/device", expires_in: 600, interval: 7 }, 1000);
  assert.equal(d.expiresAt, 601_000);
  assert.equal(d.interval, 7);
  assert.equal(parseDeviceStart({ device_code: "D", user_code: "U", verification_uri: "v" }, 0).interval, 5);
  assert.throws(() => parseDeviceStart({ message: "invalid client" }, 0), /invalid client/);
  assert.equal(prettyCode("ABCD1234"), "ABCD-1234");
  assert.equal(prettyCode("AB-CD"), "AB-CD");
});

test("poll classification covers GitHub and Twitch shapes, and backoff", () => {
  assert.equal(classifyPoll({ error: "authorization_pending" }).kind, "pending");
  assert.equal(classifyPoll({ status: 400, message: "authorization_pending" }).kind, "pending");
  assert.equal(classifyPoll({ error: "slow_down" }).kind, "slow_down");
  assert.equal(classifyPoll({ error: "access_denied" }).kind, "denied");
  assert.equal(classifyPoll({ error: "expired_token" }).kind, "expired");
  assert.equal(classifyPoll({ access_token: "t" }).kind, "done");
  assert.equal(classifyPoll({ error: "weird" }).kind, "error");
  assert.equal(nextInterval(5, "slow_down"), 10);
  assert.equal(nextInterval(5, "pending"), 5);
});
