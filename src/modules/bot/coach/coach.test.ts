import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { aocKey, aocPageText, parseAocKey, parseCtf, parsePasted, splitInput, todayAoc, validAoc } from "./puzzles.ts";
import { PRACTICE, practiceForDay } from "./bundled.ts";
import { cleanCookie, fetchPlan, MIN_GAP_MS } from "./throttle.ts";
import { answerOf, capRun, capText, verdict } from "./runCap.ts";
import { formatRecap, mistakeNotes, parseHint, parseRecap, parseSolve, unfence } from "./recap.ts";
import { streak, topicCounts, yourTurnCount } from "./progress.ts";
import { solveMessages, hintMessages } from "./prompts.ts";
import { conceptMessages, ctfHintMessages, parseConcepts, scrubFlag } from "./ctfPrompts.ts";
import { adaptDifficulty, checkTests, parseGenerated, parseQuiz, quizResult, quizScore, questionsOf, testsOf, weakTopics } from "./gen.ts";
import { b64, caesar, hex, rot13, sha256Hex, vigenere, xorHex } from "./ctfCipher.ts";
import { CTF_CATEGORIES, ctfPuzzle, flagOk, makeCtf } from "./ctfGen.ts";

const ok = (stdout: string) => ({ stdout, stderr: "", code: 0, timedOut: false });

describe("puzzle parsing", () => {
  test("aoc keys and dates", () => {
    assert.equal(aocKey(2023, 4), "aoc:2023:4");
    assert.deepEqual(parseAocKey("aoc:2023:4"), { year: 2023, day: 4 });
    assert.equal(parseAocKey("x"), null);
    assert.ok(validAoc(2015, 1) && !validAoc(2014, 1) && !validAoc(2020, 26));
    assert.deepEqual(todayAoc(new Date("2025-12-03T06:00:00Z")), { year: 2025, day: 3 });
    assert.deepEqual(todayAoc(new Date("2025-12-03T04:00:00Z")), { year: 2025, day: 2 });
    assert.equal(todayAoc(new Date("2025-12-26T12:00:00Z")), null);
  });
  test("aoc page to text", () => {
    const html = `<main><article class="day-desc"><h2>--- Day 1: Trebuchet?! ---</h2><p>Sum &amp; <em>digits</em>.</p><pre><code>1abc2\n</code></pre></article><p>junk</p></main>`;
    const r = aocPageText(html);
    assert.equal(r.title, "Day 1: Trebuchet?!");
    assert.match(r.text, /Sum & digits\./);
    assert.match(r.text, /1abc2/);
    assert.doesNotMatch(r.text, /junk|</);
  });
  test("pasted and ctf", () => {
    assert.equal(parsePasted("short"), null);
    const p = parsePasted("# Two Sum\nGiven numbers find a pair.\nINPUT:\n1 2 3", 5)!;
    assert.equal(p.title, "Two Sum");
    assert.equal(splitInput(p).input, "1 2 3");
    assert.match(splitInput(p).statement, /find a pair\.$/);
    const c = parseCtf("Baby crypto: decode the string we found", "out", 7)!;
    assert.equal(c.source, "ctf"); assert.equal(c.input, "out");
  });
  test("bundled set is well-formed", () => {
    assert.ok(PRACTICE.length >= 5);
    assert.equal(new Set(PRACTICE.map((p) => p.key)).size, PRACTICE.length);
    assert.equal(practiceForDay(-1).key, PRACTICE[PRACTICE.length - 1].key);
  });
});

describe("throttle", () => {
  test("cache first, then spacing", () => {
    assert.deepEqual(fetchPlan("page", { statement: "x" }, 0, 1), { kind: "cached" });
    assert.deepEqual(fetchPlan("input", { statement: "x" }, null, 1), { kind: "fetch" });
    assert.deepEqual(fetchPlan("input", null, 1000, 1000 + MIN_GAP_MS - 500), { kind: "wait", ms: 500 });
    assert.deepEqual(fetchPlan("input", null, 1000, 1000 + MIN_GAP_MS), { kind: "fetch" });
  });
  test("cookie cleaning", () => {
    const v = "ab".repeat(48);
    assert.equal(cleanCookie(`session=${v}; Path=/`), v);
    assert.equal(cleanCookie("nope"), null);
  });
});

describe("run capping", () => {
  test("caps and verdicts", () => {
    assert.equal(capText("abc", 5).cut, false);
    const r = capRun({ stdout: "x".repeat(20), stderr: "y".repeat(20), code: 0, timedOut: false }, 10);
    assert.ok(r.truncated && r.stdout.startsWith("x".repeat(10)) && /10 more/.test(r.stdout));
    assert.equal(answerOf(ok("a\n42\n\n")), "42");
    assert.match(verdict(ok("16\n"), "16"), /^Correct/);
    assert.match(verdict(ok("1\n"), "16"), /expected 16/);
    assert.match(verdict({ ...ok(""), timedOut: true }), /time limit/);
    assert.match(verdict({ ...ok(""), code: 1 }), /crashed/);
  });
});

describe("recap", () => {
  test("solve parsing", () => {
    assert.ok("error" in parseSolve("nope"));
    assert.ok("error" in parseSolve('{"code": ""}'));
    const s = parseSolve(JSON.stringify({ restate: "r", plan: ["a", 1], code: "```py\nprint(1)\n```", steps: ["s"] }));
    assert.ok(!("error" in s) && s.code === "print(1)" && s.plan.length === 1);
    assert.equal(unfence("x"), "x");
  });
  test("recap formatting", () => {
    const r = parseRecap(JSON.stringify({ learned: ["sets"], mistakes: ["off by one"], topics: ["Loops"], quiz: { question: "Why?", answer: "Because" } }));
    const t = formatRecap(r, "Correct: 16.");
    assert.equal(t, "Result: Correct: 16.\nWhat we learned:\n- sets\nMistakes:\n- off by one\nTopics: loops\nYour quiz: Why?");
    assert.deepEqual(mistakeNotes("Sum", r), ["Coach (Sum): off by one"]);
    assert.equal(formatRecap(parseRecap("bad"), "x"), "Result: x");
    assert.equal(parseHint('{"hint":"try a set"}'), "try a set");
  });
  test("prompts keep puzzle as data and hints code-free", () => {
    const p = PRACTICE[0];
    assert.match(solveMessages(p, "python", ["m"])[1].content, /PAST MISTAKES/);
    assert.match(hintMessages(p, "", "", 0)[0].content, /never a full solution/);
    assert.match(conceptMessages(p)[0].content, /untrusted DATA/);
    assert.match(ctfHintMessages(p, 99, "")[1].content, /level 4 of 4/);
    assert.deepEqual(parseConcepts('{"concepts":["a"],"topics":["XOR"]}'), { concepts: ["a"], next: [], topics: ["xor"] });
    assert.equal(scrubFlag("the flag{x} is", "flag{x}"), "the [hidden] is");
  });
});

describe("progress", () => {
  test("streak and topics", () => {
    const today = new Date("2026-10-29T10:00:00Z");
    assert.equal(streak(["2026-10-29 01:00:00", "2026-10-28 09:00:00", "2026-10-26 09:00:00"], today), 2);
    assert.equal(streak(["2026-10-28 09:00:00", "2026-10-27 09:00:00"], today), 2);
    assert.equal(streak(["2026-10-20 09:00:00"], today), 0);
    const rows = [{ created_at: "", topics: '["bfs","loops"]', mode: "yours" }, { created_at: "", topics: '["loops"]', mode: "coach" }, { created_at: "", topics: "bad", mode: "coach" }];
    assert.deepEqual(topicCounts(rows), [["loops", 2], ["bfs", 1]]);
    assert.equal(yourTurnCount(rows), 1);
  });
});

describe("make your own", () => {
  test("generated puzzles and quizzes", () => {
    assert.ok("error" in parseGenerated('{"statement":"s","tests":[{"input":"1","output":"1"}]}'));
    const g = parseGenerated(JSON.stringify({ title: "T", statement: "S", tests: [{ input: "1", output: "2" }, { input: "2", output: 3 }] }), 1);
    assert.ok(!("error" in g));
    const tests = testsOf(g as never);
    assert.equal(tests[1].output, "3");
    const c = checkTests(tests, [ok("2\n"), ok("4\n")]);
    assert.equal(c.summary, "FAIL 1/2 hidden tests (failed: 2)");
    assert.equal(checkTests(tests, [ok("2"), ok("3")]).summary, "PASS 2/2 hidden tests");
    const q = parseQuiz(JSON.stringify({ questions: [{ q: "a", choices: ["x", "y"], answer: 1 }, { q: "b", choices: ["x", "y"], answer: 0 }, { q: "c", choices: ["x"], answer: 0 }] }), 1);
    assert.ok(!("error" in q));
    const qs = questionsOf(q as never);
    assert.equal(qs.length, 2);
    assert.equal(quizScore(qs, [1, 1]), 1);
    assert.equal(quizResult(4, 5), "Quiz 4/5 (pass)");
  });
  test("difficulty adapts", () => {
    const P = { result: "PASS 4/4 hidden tests", topics: '["dp"]' }, F = { result: "FAIL 0/4", topics: '["bfs"]' };
    assert.equal(adaptDifficulty([P, P, P, P, F], "easy"), "medium");
    assert.equal(adaptDifficulty([F, F, F, P], "medium"), "easy");
    assert.equal(adaptDifficulty([P, F], "medium"), "medium");
    assert.deepEqual(weakTopics([F, F, P]), ["bfs"]);
  });
});

describe("practice ctf", () => {
  test("ciphers round-trip", async () => {
    assert.equal(b64("hi"), "aGk=");
    assert.equal(hex("A"), "41");
    assert.equal(rot13(rot13("Flag{x}")), "Flag{x}");
    assert.equal(caesar("abz", 1), "bca");
    assert.equal(vigenere(vigenere("hello world", "key"), "key", -1), "hello world");
    assert.equal(xorHex("a", "a"), "00");
    assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  test("deterministic and solvable", async () => {
    for (const cat of CTF_CATEGORIES) for (const d of ["easy", "medium", "hard"] as const) {
      const a = await makeCtf(42, cat, d), b = await makeCtf(42, cat, d);
      assert.deepEqual(a, b);
      assert.match(a.flag, /^flag\{[^}]+\}$/);
      assert.ok(a.body.length > 10);
    }
    const e = await makeCtf(7, "encoding", "easy");
    const data = e.body.split("\n").pop()!;
    assert.ok([atob(data), Buffer.from(data, "hex").toString(), rot13(data)].includes(e.flag));
    const l = await makeCtf(3, "logs", "medium");
    const n = Number(/\{(\d+)\}/.exec(l.flag)![1]);
    assert.match(l.body.split("\n\n")[1].split("\n")[n - 1], /POST \/login/);
    const h = await makeCtf(9, "hashing", "medium");
    assert.match(h.body, new RegExp(await sha256Hex(h.flag.slice(5, -1))));
    assert.ok(flagOk(" FLAG{A} ", "flag{a}"));
    assert.equal(JSON.parse(ctfPuzzle(e, 7).input!).flag, e.flag);
  });
});
