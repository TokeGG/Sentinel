import { test } from "node:test";
import assert from "node:assert/strict";
import type { Action, Observation } from "./actions.ts";
import { DEFAULT_BROWSER_BRAIN } from "./brainSpecs.ts";
import { makeCorrelator, type BotResult } from "./correlator.ts";
import { actScript, makeDriver, toObservation, typeRefusal } from "./driverCore.ts";

/** A fake Rust side: replies to each command with `reply(cmd, args)` (a BotResult body) or stays silent (timeout). */
function rig(reply: (cmd: string, args: Record<string, unknown>) => { ok: boolean; json: string } | null, tweak: Record<string, number> = {}) {
  const corr = makeCorrelator({ set: () => 0, clear: () => {} });
  const calls: { cmd: string; args: Record<string, unknown> }[] = [];
  let n = 0;
  const invoke = async (cmd: string, args: Record<string, unknown>) => {
    calls.push({ cmd, args });
    const id = (args.scriptId ?? args.id) as string | undefined;
    const r = id ? reply(cmd, args) : null;
    if (r && id) queueMicrotask(() => corr.deliver({ id, ...r } as BotResult));
  };
  const d = makeDriver({ invoke, corr, brain: { ...DEFAULT_BROWSER_BRAIN, ...tweak }, nextId: () => `c${++n}`, sleep: async () => {} });
  return { d, calls, corr };
}
const obs = (over: Record<string, unknown> = {}) => ({ url: "https://a.test/", title: "T", text: "hi", hash: "h1", scroll: { x: 0, y: 0, max: 0 }, elements: [{ id: "0", role: "textbox", text: "Name", visible: true, rect: [1, 2, 3, 4] }, { id: "1", role: "password", text: "Password", visible: true }], ...over });
const okJson = (v: unknown) => ({ ok: true, json: JSON.stringify(v) });

test("toObservation keeps only the known fields and caps them; rejects junk", () => {
  const o = toObservation(obs({ title: "x".repeat(999) }))!;
  assert.equal(o.title.length, 300);
  assert.deepEqual(Object.keys(o.elements[0]).sort(), ["id", "role", "text", "visible"]);
  assert.equal(toObservation(null), null);
  assert.equal(toObservation({ elements: "no", hash: "h" }), null);
  assert.equal(toObservation({ elements: [{ text: "no id" }], hash: "h" })!.elements.length, 0);
});

test("observe runs window.__sb.observe() and maps the reply", async () => {
  const r = rig(() => okJson(obs()));
  const o = await r.d.driver.observe();
  assert.equal(o.hash, "h1");
  assert.equal(r.calls[0].cmd, "bot_run");
  assert.equal(r.calls[0].args.js, "window.__sb.observe()");
  assert.equal(r.calls[0].args.timeoutMs, 15000);
});

test("observe re-looks when the page navigated under it, then gives an error observation instead of throwing", async () => {
  let k = 0;
  const r = rig(() => (k++ < 1 ? okJson({ navigated: true, url: "u" }) : okJson(obs())));
  assert.equal((await r.d.driver.observe()).hash, "h1");
  const bad = rig(() => ({ ok: false, json: JSON.stringify("timeout") }));
  const e = await bad.d.driver.observe();
  assert.equal(e.elements.length, 0);
  assert.match(e.text, /browser unavailable: timeout/);
  const never = rig(() => okJson({ navigated: true }));
  assert.match((await never.d.driver.observe()).text, /did not settle/);
});

test("actScript builds the page call; irreversible kinds click; non-page actions have none", () => {
  const b = { ...DEFAULT_BROWSER_BRAIN, waitAfterAction: 100, scrollStep: 0.5 };
  assert.equal(actScript({ type: "purchase", target: "3" }, b), 'window.__sb.act({"type":"click","target":"3","settle":200})');
  assert.equal(actScript({ type: "scroll", dir: "up" }, b), 'window.__sb.act({"type":"scroll","dir":"up","step":0.5,"settle":200})');
  assert.ok(actScript({ type: "type", target: "0", text: 'a"b' }, b)!.includes('"text":"a\\"b"'));
  for (const a of [{ type: "goto", url: "https://a.test" }, { type: "done", result: "x" }, { type: "tool", server: "s", name: "n", args: {} }] as Action[]) assert.equal(actScript(a, b), null);
});

test("the bot never types into a password field", async () => {
  const last: Observation = toObservation(obs())!;
  assert.match(typeRefusal({ type: "type", target: "1", text: "secret" }, last)!, /password/);
  assert.equal(typeRefusal({ type: "type", target: "0", text: "Bob" }, last), null);
  assert.equal(typeRefusal({ type: "click", target: "1" }, last), null);
  const r = rig((_c, a) => (String(a.js).includes("observe") ? okJson(obs()) : okJson({ changed: true })));
  await r.d.driver.observe();
  const res = await r.d.driver.act({ type: "type", target: "1", text: "hunter2" });
  assert.equal(res.ok, false);
  assert.ok(!r.calls.some((c) => JSON.stringify(c).includes("hunter2")), "the secret never reaches the page command");
  assert.equal((await r.d.driver.act({ type: "type", target: "0", text: "Bob" })).ok, true);
});

test("act maps changed, failures and timeouts", async () => {
  const r = rig((_c, a) => (String(a.js).includes('"click"') ? okJson({ changed: false }) : { ok: false, json: JSON.stringify("timeout") }));
  assert.deepEqual(await r.d.driver.act({ type: "click", target: "0" }), { ok: true, changed: false });
  const t = await r.d.driver.act({ type: "scroll", dir: "down" });
  assert.deepEqual([t.ok, t.timedOut, t.error], [false, true, "timeout"]);
  const e = rig(() => ({ ok: false, json: JSON.stringify("unknown element (stale or detached)") }));
  assert.deepEqual(await e.d.driver.act({ type: "click", target: "9" }), { ok: false, error: "unknown element (stale or detached)", changed: false, timedOut: false });
});

test("goto goes through bot_navigate; a rejected invoke becomes a failed result, not a throw", async () => {
  const r = rig((c) => (c === "bot_navigate" ? okJson({ url: "https://b.test/" }) : null));
  assert.deepEqual(await r.d.driver.act({ type: "goto", url: "https://b.test/" }), { ok: true, changed: true });
  assert.equal(r.calls[0].cmd, "bot_navigate");
  assert.equal(r.calls[0].args.url, "https://b.test/");
  const corr = makeCorrelator({ set: () => 0, clear: () => {} });
  const d = makeDriver({ invoke: async () => { throw new Error("navigation to file is not allowed"); }, corr, brain: DEFAULT_BROWSER_BRAIN, nextId: () => "x", sleep: async () => {} });
  const res = await d.driver.act({ type: "goto", url: "file:///c:/x" });
  assert.equal(res.ok, false);
  assert.match(res.error!, /not allowed/);
  assert.equal(corr.size(), 0);
});

test("tool actions run through runTool; its reply is the step output, a throw is a failed step", async () => {
  const corr = makeCorrelator({ set: () => 0, clear: () => {} });
  const mk = (runTool: (a: Extract<Action, { type: "tool" }>) => Promise<string>) => makeDriver({ invoke: async () => {}, corr, brain: DEFAULT_BROWSER_BRAIN, nextId: () => "x", sleep: async () => {}, runTool });
  const a: Action = { type: "tool", server: "s", name: "n", args: {} };
  assert.deepEqual(await mk(async () => "42").driver.act(a), { ok: true, changed: false, output: "42" });
  const f = await mk(async () => { throw new Error("flagged"); }).driver.act(a);
  assert.deepEqual([f.ok, f.error], [false, "flagged"]);
});
