import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrowserDriver, Observation } from "./actions.ts";
import { describeAction, describeResult, logDriver, logLlm, pushLog, type LogEntry } from "./logging.ts";

const obs: Observation = { url: "https://a.test/", title: "A", text: "", hash: "h", elements: [{ id: "0", role: "link", text: "x", visible: true }] };

test("decorators report observe, act and the model reply, and pass results through unchanged", async () => {
  const lines: string[] = [];
  const log = (k: string, t: string) => lines.push(`${k}:${t}`);
  const d: BrowserDriver = { observe: async () => obs, act: async () => ({ ok: true, changed: true, output: "reply" }) };
  const ld = logDriver(d, log);
  assert.equal(await ld.observe(), obs);
  assert.deepEqual(await ld.act({ type: "click", target: "0" }), { ok: true, changed: true, output: "reply" });
  const l = logLlm({ decide: async () => '{"type":\n"wait"}' }, log);
  assert.equal(await l.decide({} as never), '{"type":\n"wait"}');
  assert.deepEqual(lines, ["page:A - https://a.test/ - 1 elements", "act:click [0]", "result:ok, page changed -> reply", 'model:{"type": "wait"}']);
});

test("descriptions never throw on odd values and clip long text", () => {
  assert.match(describeAction({ type: "type", target: "1", text: "x".repeat(500) }), /^type "x{60}" into \[1\]$/);
  assert.equal(describeAction({ type: "goto", url: "https://a.test" }), "go to https://a.test");
  assert.equal(describeResult({ ok: false, error: "boom", changed: false, timedOut: true }), "failed: boom (timed out)");
  assert.equal(describeResult({ ok: true, changed: false }), "ok, page unchanged");
});

test("pushLog is bounded and keeps the newest", () => {
  let list: LogEntry[] = [];
  for (let i = 0; i < 10; i++) list = pushLog(list, { kind: "info", text: String(i), at: i }, 4);
  assert.deepEqual(list.map((e) => e.text), ["6", "7", "8", "9"]);
});
