import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText, htmlToText, makeNote, noteLines, retrieve, tokenize, type Note } from "./knowledge.ts";
import * as q from "./sql.ts";
import { newPopulation } from "./kernel/variants.ts";
import { seededRng } from "./kernel/brain.ts";
import { BROWSER_SPECS, DEFAULT_BROWSER_BRAIN } from "./brainSpecs.ts";
import { learnFromEpisode } from "./learn.ts";
import type { Episode } from "./actions.ts";
import { readFileSync } from "node:fs";
import { BOT_STATEMENTS } from "../../core/schemaBot.ts";

const notes: Note[] = [
  { id: 1, title: "Flights", source: "text", text: "To book a flight use the search form. Enter origin and destination airports, then pick dates.\n\nCheap flights are usually on Tuesdays." },
  { id: 2, title: "Recipes", source: "text", text: "Boil pasta for ten minutes. Add salt to the water." },
  { id: 3, title: "Login", source: "https://a.test/login", text: "The login button is in the top right corner of the header." },
];

test("tokenize drops stop words and punctuation", () => {
  assert.deepEqual(tokenize("The Login-button, is at: the TOP!"), ["login", "button", "top"]);
});

test("htmlToText strips scripts, styles, tags and entities", () => {
  assert.equal(htmlToText("<style>a{}</style><p>Hi &amp; bye</p><script>evil()</script><b>x</b>"), "Hi & bye x");
});

test("makeNote validates text and source, trims and caps", () => {
  assert.deepEqual(makeNote("", "  "), { ok: false, error: "empty note" });
  assert.equal(makeNote("t", "x", "javascript:alert(1)").ok, false);
  assert.equal(makeNote("t", "x", "file:///etc/passwd").ok, false);
  const n = makeNote("", "hello", "https://a.test/p");
  assert.ok(n.ok && n.note.title === "https://a.test/p" && n.note.source === "https://a.test/p");
  const big = makeNote("t", "x".repeat(60_000));
  assert.ok(big.ok && big.note.text.length === 50_000);
});

test("chunkText keeps chunks within the limit and loses no words", () => {
  const text = "Alpha beta gamma. ".repeat(100) + "\n\nSecond paragraph here.";
  const c = chunkText(text, 120);
  assert.ok(c.every((x) => x.length <= 120), "all within limit");
  assert.equal(c.join(" ").replace(/\s+/g, " ").includes("Second paragraph here."), true);
  assert.equal(c.join(" ").match(/Alpha/g)?.length, 100);
  assert.deepEqual(chunkText("", 100), []);
  assert.ok(chunkText("x".repeat(1000), 100).every((x) => x.length <= 100));
});

test("retrieve ranks relevant snippets first (BM25), returns top-k, nothing for no overlap", () => {
  const r = retrieve(notes, "how do I book a cheap flight", 2);
  assert.equal(r[0].noteId, 1);
  assert.ok(r.length <= 2);
  assert.equal(retrieve(notes, "where is the login button")[0].noteId, 3);
  assert.deepEqual(retrieve(notes, "quantum chromodynamics"), []);
  assert.deepEqual(retrieve(notes, "flight", 0), []);
  assert.deepEqual(retrieve([], "flight"), []);
  assert.ok(noteLines(r)[0].startsWith("Flights: "));
});

test("sql builders are parameterised", () => {
  const i = q.insertNote({ title: "t'; DROP TABLE x;--", source: "text", text: "b" });
  assert.ok(!i.sql.includes("DROP"));
  assert.deepEqual(i.params, ["t'; DROP TABLE x;--", "text", "b"]);
  assert.deepEqual(q.deleteNote(3).params, [3]);
  assert.equal(q.recentEpisodes(9999).params[0], 200);
  assert.equal(q.recentEpisodes(-5).params[0], 1);
  const e: Episode = { goal: "g", steps: [], outcome: "done", maxSteps: 25, startedAt: 0, endedAt: 1, thumbs: "up" };
  const ie = q.insertEpisode(e);
  assert.deepEqual(ie.params.slice(0, 4), ["g", "done", 0, "up"]);
  assert.equal(JSON.parse(ie.params[4] as string).goal, "g");
  assert.deepEqual(q.putBrain("pop:browser", { a: 1 }).params, ["pop:browser", '{"a":1}']);
});

test("parsePopulation / parseLessons survive garbage", () => {
  const pop = newPopulation(BROWSER_SPECS, "browser", DEFAULT_BROWSER_BRAIN, seededRng(1));
  assert.deepEqual(q.parsePopulation(JSON.stringify(pop)), pop);
  for (const bad of [undefined, "", "{", "null", "{}", '{"variants":[]}', '{"variants":[{"id":1}]}']) assert.equal(q.parsePopulation(bad), null);
  assert.deepEqual(q.parseLessons('{"a":{"value":1,"weight":2},"b":{"value":"x"},"c":null}'), { a: { value: 1, weight: 2 } });
  assert.deepEqual(q.parseLessons("nope"), {});
});

test("migration 28 matches the SCHEMA_STATEMENTS bootstrap and is idempotent", () => {
  const sql = readFileSync(new URL("../../../src-tauri/migrations/28_bot.sql", import.meta.url), "utf8");
  const parts = sql.split(/;\s*\n/).filter((x) => x.trim());
  assert.equal(parts.length, BOT_STATEMENTS.length);
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/;$/, "");
  parts.forEach((p, i) => { assert.match(p, /CREATE TABLE IF NOT EXISTS/); assert.equal(norm(p), norm(BOT_STATEMENTS[i])); });
  for (const t of ["bot_notes", "bot_episodes", "bot_brain"]) assert.ok(BOT_STATEMENTS.some((s) => s.includes(t)));
});

test("learnFromEpisode: credits the variant, adds a capped lesson variant, drift-limited, deterministic", () => {
  const mk = () => ({ pop: newPopulation(BROWSER_SPECS, "browser", DEFAULT_BROWSER_BRAIN, seededRng(1)), lessons: {} });
  const bad: Episode = { goal: "g", outcome: "failed", maxSteps: 25, startedAt: 0, endedAt: 1, variantId: "g0v0", steps: Array.from({ length: 6 }, () => ({ obs: "h", action: { type: "click", target: "b" } as const, ok: false, error: "boom", changed: false })) };
  const a = mk(), b = mk();
  const la = learnFromEpisode(a, bad, seededRng(2));
  learnFromEpisode(b, bad, seededRng(2));
  assert.deepEqual(a, { pop: b.pop, lessons: a.lessons });
  assert.ok(la.waitAfterAction.weight >= 96 && la.loopPatience);
  const lesson = a.pop.variants.find((v) => v.id.startsWith("l"));
  assert.ok(lesson, "a lesson variant joined");
  assert.ok(lesson.brain.waitAfterAction > 900 && lesson.brain.waitAfterAction <= 900 + 0.2 * 4800 + 1e-6);
  assert.equal(a.pop.variants.length, 6);
});
