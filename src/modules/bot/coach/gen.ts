// "Make your own": the local model invents practice puzzles (with hidden tests) or concept quizzes, pitched by the
// owner's past results. Pure: prompts, strict parsing, test checking and difficulty adaptation.
import type { ChatMessage } from "../llm.ts";
import type { Puzzle } from "./puzzles.ts";
import { answerOf, type RunResult } from "./runCap.ts";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const CODING_TOPICS = ["strings", "loops", "hash maps", "sorting", "recursion", "stacks", "BFS", "dynamic programming", "math", "parsing"];
export const QUIZ_TOPICS = ["networking basics", "TCP/IP and ports", "DNS", "HTTP", "cryptography basics", "web security", "Linux basics", "authentication"];
export interface Test { input: string; output: string }
export interface Question { q: string; choices: string[]; answer: number; why: string }

const SYS = "You write fair, self-contained practice material for a learner. Reply with ONE JSON object only.";
export function genMessages(kind: "code" | "quiz", difficulty: Difficulty, topic: string, weak: string[]): ChatMessage[] {
  const w = weak.length ? ` The learner is weak at: ${weak.join(", ")}; lean on those if they fit.` : "";
  const ask = kind === "code"
    ? `Invent a ${difficulty} programming puzzle about ${topic}. The program reads stdin and prints one answer line. Give 4 hidden test cases whose outputs you have checked carefully.
JSON: {"title": "...", "statement": "full problem incl. input format and one worked example", "tests": [{"input": "...", "output": "..."}]}`
    : `Write a ${difficulty} 5-question multiple-choice quiz on ${topic} fundamentals.
JSON: {"title": "...", "questions": [{"q": "...", "choices": ["a","b","c","d"], "answer": 0, "why": "short explanation"}]}`;
  return [{ role: "system", content: SYS }, { role: "user", content: ask + w }];
}

const obj = (t: string): Record<string, unknown> => { try { const j = JSON.parse(t); return j && typeof j === "object" && !Array.isArray(j) ? j : {}; } catch { return {}; } };
const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : typeof v === "number" ? String(v) : "");

/** Generated coding puzzle; tests are kept (hidden from the UI) as JSON in `input`. */
export function parseGenerated(text: string, now = Date.now()): Puzzle | { error: string } {
  const o = obj(text);
  const tests = (Array.isArray(o.tests) ? o.tests : []).map((t) => ({ input: str((t as Test)?.input, 20000), output: str((t as Test)?.output, 2000).trim() })).filter((t) => t.output).slice(0, 10);
  if (!str(o.statement, 1) || tests.length < 2) return { error: "The model did not produce a usable puzzle with tests. Try again." };
  return { key: `gen:${now}`, source: "gen", title: str(o.title, 80).trim() || "Generated puzzle", statement: str(o.statement, 8000), input: JSON.stringify(tests) };
}
export function parseQuiz(text: string, now = Date.now()): Puzzle | { error: string } {
  const o = obj(text);
  const qs: Question[] = (Array.isArray(o.questions) ? o.questions : []).map((x) => x as Record<string, unknown>).map((x) => ({
    q: str(x.q, 400), choices: Array.isArray(x.choices) ? x.choices.map((c) => str(c, 200)).slice(0, 6) : [], answer: Number(x.answer), why: str(x.why, 400) }))
    .filter((x) => x.q && x.choices.length >= 2 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.choices.length).slice(0, 10);
  if (qs.length < 2) return { error: "The model did not produce a usable quiz. Try again." };
  return { key: `quiz:${now}`, source: "quiz", title: str(o.title, 80).trim() || "Concept quiz", statement: qs.map((x, i) => `${i + 1}. ${x.q}`).join("\n"), input: JSON.stringify(qs) };
}
export function testsOf(p: Puzzle): Test[] { try { const t = JSON.parse(p.input ?? "[]"); return Array.isArray(t) ? t : []; } catch { return []; } }
export const questionsOf = (p: Puzzle) => testsOf(p) as unknown as Question[];

/** Compare each hidden test's run with its expected last line. */
export function checkTests(tests: Test[], runs: RunResult[]): { passed: number; total: number; summary: string } {
  const ok = tests.map((t, i) => !!runs[i] && runs[i].code === 0 && !runs[i].timedOut && answerOf(runs[i]) === t.output.trim());
  const passed = ok.filter(Boolean).length;
  return { passed, total: tests.length, summary: passed === tests.length ? `PASS ${passed}/${tests.length} hidden tests` : `FAIL ${passed}/${tests.length} hidden tests (failed: ${ok.map((x, i) => (x ? 0 : i + 1)).filter(Boolean).join(", ")})` };
}
export const quizScore = (qs: Question[], picks: number[]) => qs.filter((q, i) => picks[i] === q.answer).length;

export interface Outcome { result: string; topics: string }
const passed = (r: string) => /^(PASS|Correct|Quiz \d+\/\d+ \(pass)/.test(r);
/** Next difficulty from the last 5 results: 4+ passes step up, 1 or fewer step down. */
export function adaptDifficulty(recent: Outcome[], current: Difficulty): Difficulty {
  const last = recent.slice(0, 5);
  if (last.length < 3) return current;
  const n = last.filter((r) => passed(r.result)).length, i = DIFFICULTIES.indexOf(current);
  return n >= 4 ? DIFFICULTIES[Math.min(2, i + 1)] : n <= 1 ? DIFFICULTIES[Math.max(0, i - 1)] : current;
}
/** Topics that appear most in failed attempts. */
export function weakTopics(recent: Outcome[], max = 3): string[] {
  const m = new Map<string, number>();
  for (const r of recent) if (!passed(r.result)) { try { for (const t of JSON.parse(r.topics)) if (typeof t === "string") m.set(t, (m.get(t) ?? 0) + 1); } catch { /* skip */ } }
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, max).map(([t]) => t);
}
export const quizResult = (score: number, total: number) => `Quiz ${score}/${total} (${score * 5 >= total * 4 ? "pass" : "keep practising"})`;
