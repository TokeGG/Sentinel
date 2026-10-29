import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAssistMessages, parseAssist, pickSkills, sourceLines, summarizeRows, type AssistSkill } from "./assistLogic.ts";

test("summarizeRows: numbered, preferred keys first, no secrets or objects", () => {
  const l = summarizeRows([{ url: "u", title: "Hello", token: "SECRET", nested: { a: 1 }, price: 3 }]);
  assert.equal(l[0], "[r1] title=Hello; price=3; url=u");
  assert.ok(!l[0].includes("SECRET"));
  assert.equal(summarizeRows(Array.from({ length: 50 }, () => ({ a: 1 })), 10).length, 10);
});

test("pickSkills: only the category, best overlap first", () => {
  const s = (name: string, categories: string[], description = "x"): AssistSkill => ({ name, description, body: "b", categories });
  const out = pickSkills("deals", [s("news-digest", ["news"]), s("coupon-sanity", ["deals"], "promo codes"), s("deal-worth-it", ["deals"], "price history")], "is this price good?", 2);
  assert.deepEqual(out.map((x) => x.name), ["deal-worth-it", "coupon-sanity"]);
});

test("buildAssistMessages carries rows, skills, knowledge, sources, actions", () => {
  const m = buildAssistMessages({ question: "q?", moduleName: "News", category: "news", rows: ["[r1] title=A"], skills: [{ name: "s", description: "", body: "do x", categories: [] }], knowledge: ["k1"], sources: ["- HN: y"], actions: [{ label: "Refresh", skill: "refresh" }] });
  assert.equal(m[0].role, "system");
  for (const part of ["[r1] title=A", "## s", "- k1", "- HN: y", "PANEL ACTIONS: Refresh"]) assert.ok(m[1].content.includes(part), part);
});

test("parseAssist: JSON, plain text, cite bounds, action allow-list", () => {
  const acts = [{ label: "Refresh quotes", skill: "refresh" }];
  const a = parseAssist(JSON.stringify({ answer: "See [r2] and r9", cites: ["r1"], action: "refresh quotes" }), 3, acts);
  assert.deepEqual(a.cites, [1, 2]);
  assert.equal(a.action?.skill, "refresh");
  const b = parseAssist(JSON.stringify({ answer: "x", action: "delete everything" }), 3, acts);
  assert.equal(b.action, null);
  const c = parseAssist("just text r1", 1, acts);
  assert.equal(c.answer, "just text r1");
  assert.deepEqual(c.cites, [1]);
});

test("sourceLines", () => {
  assert.deepEqual(sourceLines([{ source: "HN", rows: [{ title: "t", detail: "d" }] }, { source: "X", rows: [], error: "HTTP 403" }]), ["- HN: t — d", "- X: unavailable (HTTP 403)"]);
});

test("safeActions drops destructive or outbound actions", async () => {
  const { safeActions } = await import("./assistLogic.ts");
  const out = safeActions([{ label: "Refresh", skill: "get_metrics" }, { label: "Apply cleanup", skill: "apply_cleanup" }, { label: "Send", skill: "send_mail" }]);
  assert.deepEqual(out.map((a) => a.label), ["Refresh"]);
});
