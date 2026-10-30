// Coach session state: current puzzle, model walkthrough, code, owner-triggered Run, recap, hints, saving.
import { useCallback, useState } from "react";
import { askCoach, runCode } from "./coachLlm";
import { pastMistakes, saveAttempt } from "./coachStore";
import { COACH_NOTE_HOST } from "./coachSql";
import { practiceByKey } from "./bundled";
import { checkTests, testsOf } from "./gen";
import { hintMessages, recapMessages, solveMessages, type Lang } from "./prompts";
import { AOC_HOST, type Puzzle } from "./puzzles";
import { formatRecap, mistakeNotes, parseHint, parseRecap, parseSolve, type Recap, type Solve } from "./recap";
import { verdict as verdictOf, type RunResult } from "./runCap";

export type Mode = "coach" | "yours";
export function useCoach() {
  const [puzzle, setPuzzleRaw] = useState<Puzzle | null>(null);
  const [mode, setMode] = useState<Mode>("coach");
  const [lang, setLang] = useState<Lang>("python");
  const [solve, setSolve] = useState<Solve | null>(null);
  const [code, setCode] = useState("");
  const [out, setOut] = useState<{ run: RunResult; verdict: string } | null>(null);
  const [recap, setRecap] = useState<{ r: Recap; text: string } | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const task = useCallback(async (label: string, f: () => Promise<void>) => {
    setBusy(label); setError(null);
    try { await f(); } catch (e) { setError(String((e as Error)?.message ?? e)); } finally { setBusy(null); }
  }, []);
  const setPuzzle = (p: Puzzle | null) => { setPuzzleRaw(p); setSolve(null); setCode(""); setOut(null); setRecap(null); setHints([]); };

  const walk = () => puzzle && task("The coach is thinking...", async () => {
    const s = parseSolve(await askCoach(solveMessages(puzzle, lang, await pastMistakes().catch(() => []))));
    if ("error" in s) throw new Error(s.error);
    setSolve(s); setCode(s.code); setOut(null); setRecap(null);
  });
  const run = () => puzzle && task("Running your code...", async () => {
    const tests = puzzle.source === "gen" ? testsOf(puzzle) : [];
    if (tests.length) {
      const runs: RunResult[] = [];
      for (const t of tests) runs.push(await runCode(lang, code, t.input));
      const c = checkTests(tests, runs);
      setOut({ run: runs.find((r, i) => r.stdout.trim().split("\n").pop()?.trim() !== tests[i].output) ?? runs[0], verdict: c.summary });
      return;
    }
    const r = await runCode(lang, code, puzzle.input ?? "");
    setOut({ run: r, verdict: verdictOf(r, practiceByKey(puzzle.key)?.answer) });
  });
  const finish = () => puzzle && out && task("Writing the recap...", async () => {
    const r = parseRecap(await askCoach(recapMessages(puzzle, code, out.run.stdout + "\n" + out.run.stderr, out.verdict)));
    const text = formatRecap(r, out.verdict);
    setRecap({ r, text });
    await saveAttempt({ puzzle_key: puzzle.key, title: puzzle.title, mode, lang, code, result: out.verdict, explanation: [solve?.restate, ...(solve?.steps ?? []), text].filter(Boolean).join("\n"),
      mistakes: mistakeNotes(puzzle.title, r), topics: r.topics }, puzzle.source === "aoc" ? AOC_HOST : COACH_NOTE_HOST);
  });
  const hint = () => puzzle && task("Thinking of a hint...", async () => {
    setHints([...hints, parseHint(await askCoach(hintMessages(puzzle, code, out ? out.run.stdout + out.run.stderr : "", hints.length)))]);
  });
  return { puzzle, setPuzzle, mode, setMode: (m: Mode) => { setMode(m); setSolve(null); setHints([]); }, lang, setLang, solve, code, setCode, out, recap, hints, busy, error, setError, task, walk, run, finish, hint };
}
export type CoachState = ReturnType<typeof useCoach>;
