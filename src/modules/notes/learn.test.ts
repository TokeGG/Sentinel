import { test } from "node:test";
import assert from "node:assert/strict";
import { isDue, newCard, parseCards, review, syncPlan } from "./sm2.ts";
import { buildGraph, forceStep } from "./graph.ts";
import { clipNote, decodeEntities, extractReadable, htmlToText, isHttpUrl } from "./clipper.ts";
import { classifyFile, extractText, searchVault } from "./vault.ts";

const now = new Date(2026, 9, 29);

test("sm2 schedule: 1, 6, then interval*ease; again resets; ease floors at 1.3", () => {
  let c = newCard(now);
  assert.ok(isDue(c, now));
  c = review(c, "good", now); assert.deepEqual([c.interval, c.reps, c.due], [1, 1, "2026-10-30"]);
  c = review(c, "good", now); assert.equal(c.interval, 6);
  c = review(c, "good", now);
  assert.ok(c.interval >= 15);
  const lapsed = review(c, "again", now); assert.deepEqual([lapsed.reps, lapsed.interval], [0, 1]);
  let h = newCard(now);
  for (let i = 0; i < 20; i++) h = review(h, "again", now);
  assert.equal(h.ease, 1.3);
  assert.ok(review(newCard(now), "easy", now).ease > 2.5);
  assert.ok(!isDue({ due: "2026-10-30" }, now));
});
test("parseCards", () => {
  const body = "Q:: A\n- Capital of FR :: Paris\n```\nx :: y\n```\nno card here\nQ:: dup";
  assert.deepEqual(parseCards(body), [{ q: "Q", a: "A" }, { q: "Capital of FR", a: "Paris" }]);
});
test("syncPlan", () => {
  const p = syncPlan([{ q: "a", a: "1" }, { q: "b", a: "2" }], [{ q: "a", a: "9" }, { q: "c", a: "3" }]);
  assert.deepEqual([p.add.map((c) => c.q), p.update.map((c) => c.q), p.remove], [["c"], ["a"], ["b"]]);
});
const note = (id: number, body: string) => ({ id, body, tags: null, filed_to: null, created_at: "2026-01-01" });
test("graph edges: resolved, unique, no self, archived skipped", () => {
  const g = buildGraph([note(1, "# A\n[[B]] [[A]] [[missing]]"), note(2, "# B\n[[a]]"), note(3, "# C\n[[B]]")], 400, 300);
  assert.equal(g.nodes.length, 3);
  assert.deepEqual(g.edges.map((e) => [e.from, e.to]), [[1, 2], [3, 2]]);
});
test("force layout is deterministic, bounded, pulls linked nodes closer", () => {
  const ns = [1, 2, 3, 4].map((i) => note(i, `# N${i}${i === 1 ? "\n[[N2]]" : ""}`));
  const g = buildGraph(ns, 400, 300);
  const run = () => { let p = g.nodes; for (let i = 0; i < 200; i++) p = forceStep(p, g.edges, 400, 300); return p; };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  for (const n of a) assert.ok(n.x >= 14 && n.x <= 386 && n.y >= 14 && n.y <= 286 && Number.isFinite(n.x));
  const d = (i: number, j: number) => Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y);
  assert.ok(d(0, 1) < d(2, 3));
});
test("coincident nodes do not produce NaN", () => {
  const p = forceStep([{ id: 1, title: "", x: 5, y: 5 }, { id: 2, title: "", x: 5, y: 5 }], [], 100, 100);
  assert.ok(p.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)));
});
test("clipper extracts title and article text", () => {
  const html = `<html><head><title>My &amp; Page</title><style>p{}</style></head><body><nav>menu</nav><article><h1>Head</h1><p>Hello <b>world</b>&nbsp;!</p><ul><li>one</li></ul><script>x()</script></article><footer>foot</footer></body></html>`;
  const r = extractReadable(html, "https://x.y");
  assert.equal(r.title, "My & Page");
  assert.equal(r.text, "# Head\n\nHello world !\n\n- one");
  assert.equal(extractReadable("<p>hi</p>", "https://u").title, "https://u");
  assert.equal(htmlToText("<!-- c --><p>a</p><p>b</p>"), "a\n\nb");
  assert.equal(decodeEntities("&#65;&#x42;&bogus;&lt;"), "AB&bogus;<");
  assert.match(clipNote("https://x", "T", "body"), /^# T\n\nSource: https:\/\/x\n\nbody\n$/);
  assert.ok(isHttpUrl("https://a.b") && !isHttpUrl("file:///x") && !isHttpUrl("javascript:1"));
});
test("vault: kinds, html extraction, pdf found by name/tags only", () => {
  assert.equal(classifyFile("a.TXT"), "text");
  assert.equal(classifyFile("a.pdf"), "pdf");
  assert.equal(classifyFile("a.exe"), null);
  assert.equal(extractText("a.html", "<p>hi</p>"), "hi");
  assert.equal(extractText("a.md", "<p>hi</p>"), "<p>hi</p>");
  const docs = [
    { id: 1, name: "notes.txt", kind: "text", text: "the quick fox", tags: "", size: 1 },
    { id: 2, name: "invoice.pdf", kind: "pdf", text: "quick", tags: "tax", size: 1 },
  ];
  assert.deepEqual(searchVault(docs, "quick").map((d) => d.id), [1]);
  assert.deepEqual(searchVault(docs, "tax invoice").map((d) => d.id), [2]);
  assert.equal(searchVault(docs, "").length, 2);
});
