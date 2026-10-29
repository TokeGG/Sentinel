import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BROWSER_BRAIN as BR } from "./brainSpecs.ts";
import { assertOllamaUrl, buildMessages, chatBody, formatObservation, isOllamaUrl, makeOllamaLlm, parseAction, relevantSkills, type DecideInput } from "./llm.ts";

const obs = { url: "https://x.test/", title: "X", text: "hello", hash: "h", elements: [{ id: "e1", role: "button", text: "Go", visible: false }, { id: "e2", role: "link", text: "Home", visible: true }] };
const ctx = { elementIds: new Set(["e1", "e2"]), tools: [{ server: "s", name: "t" }] };
const input = (o: Partial<DecideInput> = {}): DecideInput => ({ goal: "find cheap flights", obs, history: [], notes: [], skills: [], tools: [], brain: BR, ...o });

test("only 127.0.0.1:11434 over http is accepted", () => {
  assert.ok(isOllamaUrl("http://127.0.0.1:11434/api/chat"));
  for (const u of ["https://127.0.0.1:11434/api/chat", "http://localhost:11434/api/chat", "http://[::1]:11434/", "http://127.0.0.1:8080/", "http://127.0.0.1/", "http://evil.com:11434/", "http://127.0.0.1.evil.com:11434/", "http://user:pw@127.0.0.1:11434/", "http://api.openai.com/v1", "garbage", ""])
    assert.equal(isOllamaUrl(u), false, u);
  assert.throws(() => assertOllamaUrl("https://api.anthropic.com"), /non-local/);
  assert.throws(() => makeOllamaLlm({ fetch: fetch, model: "m", url: "http://example.com/api/chat" }), /non-local/);
});

test("chat request asks for JSON output with the brain's temperature", () => {
  const b = chatBody("llama3", buildMessages(input()), { ...BR, temperature: 0.7 });
  assert.equal(b.format, "json");
  assert.equal(b.stream, false);
  assert.equal(b.model, "llama3");
  assert.equal(b.options.temperature, 0.7);
});

test("prompt holds rules, goal, skills, tools, notes, history and the page; page data is marked untrusted", () => {
  const m = buildMessages(input({
    skills: [{ name: "flights", description: "x", body: "SKILLBODY" }], tools: [{ server: "srv", name: "tool1", description: "does things" }],
    notes: ["NOTE-ONE"], history: [{ obs: "h", action: { type: "scroll", dir: "down" }, ok: false, error: "BOOM", changed: false }, { obs: "h", action: null, ok: false, error: "refused", changed: false }],
  }));
  assert.equal(m[0].role, "system");
  assert.match(m[0].content, /ONE JSON object/);
  const u = m[1].content;
  for (const s of ["GOAL: find cheap flights", "SKILLBODY", "srv/tool1", "NOTE-ONE", "ERROR BOOM", "(invalid answer)", "[e2] link", "untrusted"]) assert.ok(u.includes(s), s);
});

test("observation puts visible elements first and obeys the element budget", () => {
  const f = formatObservation(obs, BR);
  assert.ok(f.indexOf("[e2]") < f.indexOf("[e1]"));
  assert.ok(f.includes("(off-screen)"));
  const small = formatObservation(obs, { ...BR, observeBudget: 10 });
  assert.ok(small.includes("[e1]"));
  const many = { ...obs, elements: Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, role: "link", text: "t", visible: true })) };
  assert.equal(formatObservation(many, { ...BR, observeBudget: 10 }).split("\n[").length - 1, 10);
  const unsorted = formatObservation(obs, { ...BR, preferVisibleFirst: 0 });
  assert.ok(unsorted.indexOf("[e1]") < unsorted.indexOf("[e2]"));
});

test("relevantSkills picks by goal overlap, clips bodies", () => {
  const sk = [{ name: "flights-search", description: "find flights", body: "x".repeat(5000) }, { name: "cooking", description: "recipes", body: "y" }];
  const r = relevantSkills("book cheap flights", sk);
  assert.deepEqual(r.map((s) => s.name), ["flights-search"]);
  assert.equal(r[0].body.length, 1500);
  assert.deepEqual(relevantSkills("zzz", sk), []);
});

test("parseAction accepts exactly the known shapes", () => {
  const ok = (o: unknown) => parseAction(JSON.stringify(o), ctx);
  assert.deepEqual(ok({ type: "click", target: "e1", extra: 1 }), { ok: true, action: { type: "click", target: "e1" } });
  assert.deepEqual(ok({ type: "submit", target: "e2" }), { ok: true, action: { type: "submit", target: "e2" } });
  assert.deepEqual(ok({ type: "type", target: "e1", text: "hi" }), { ok: true, action: { type: "type", target: "e1", text: "hi" } });
  assert.deepEqual(ok({ type: "scroll", dir: "up" }), { ok: true, action: { type: "scroll", dir: "up" } });
  assert.deepEqual(ok({ type: "goto", url: "https://a.b/c" }), { ok: true, action: { type: "goto", url: "https://a.b/c" } });
  assert.deepEqual(ok({ type: "wait" }), { ok: true, action: { type: "wait" } });
  assert.deepEqual(ok({ type: "tool", server: "s", name: "t", args: { a: 1 } }), { ok: true, action: { type: "tool", server: "s", name: "t", args: { a: 1 } } });
  assert.deepEqual(ok({ type: "done", result: "ok" }), { ok: true, action: { type: "done", result: "ok" } });
  assert.deepEqual(ok({ type: "fail", reason: "no" }), { ok: true, action: { type: "fail", reason: "no" } });
});

test("parseAction rejects unknown actions, elements, tools, schemes and junk", () => {
  const bad = (t: string) => assert.equal(parseAction(t, ctx).ok, false, t);
  for (const t of ["", "nope", "[]", "null", "42", '"click"', "```json\n{}\n```", "{}", '{"type":"rm_rf"}', '{"type":"eval","code":"1"}', '{"type":5}',
    '{"type":"click"}', '{"type":"click","target":"zz"}', '{"type":"click","target":5}', '{"type":"type","target":"e1"}', '{"type":"press"}',
    '{"type":"scroll","dir":"left"}', '{"type":"goto","url":"javascript:alert(1)"}', '{"type":"goto","url":"file:///etc/passwd"}', '{"type":"goto","url":"nope"}',
    '{"type":"tool","server":"s","name":"other"}', '{"type":"tool","server":"x","name":"t"}', '{"type":"done"}', '{"type":"fail"}', `{"type":"press","key":"${"k".repeat(30)}"}`])
    bad(t);
});

test("makeOllamaLlm posts to the local endpoint and returns the message content", async () => {
  const calls: { url: string; body: any }[] = [];
  const f = (async (url: string, init: any) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ message: { content: '{"type":"wait"}' } }) }; }) as unknown as typeof fetch;
  const llm = makeOllamaLlm({ fetch: f, model: "m1" });
  assert.equal(await llm.decide(input()), '{"type":"wait"}');
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/chat");
  assert.equal(calls[0].body.model, "m1");
  await assert.rejects(makeOllamaLlm({ fetch: f, model: "" }).decide(input()), /no local model/);
  const f500 = (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
  await assert.rejects(makeOllamaLlm({ fetch: f500, model: "m" }).decide(input()), /ollama 500/);
  const fEmpty = (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
  await assert.rejects(makeOllamaLlm({ fetch: fEmpty, model: "m" }).decide(input()), /empty/);
});
