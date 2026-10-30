// Pure SQL builders for migration 46 (coach_puzzles cache, coach_attempts).
import type { Q } from "../sql.ts";
import type { Puzzle } from "./puzzles.ts";

export interface Attempt { puzzle_key: string; title: string; mode: "coach" | "yours"; lang: string; code: string; result: string; explanation: string; mistakes: string[]; topics: string[] }
export const getPuzzle = (key: string): Q => ({ sql: "SELECT key, source, title, statement, input, notes FROM coach_puzzles WHERE key = $1", params: [key] });
export const listPuzzles = (): Q => ({ sql: "SELECT key, source, title, statement, input, notes FROM coach_puzzles ORDER BY fetched_at DESC LIMIT 100", params: [] });
export const putPuzzle = (p: Puzzle): Q => ({
  sql: "INSERT INTO coach_puzzles (key, source, title, statement, input) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(key) DO UPDATE SET title = $3, statement = $4, input = COALESCE($5, coach_puzzles.input)",
  params: [p.key, p.source, p.title.slice(0, 200), p.statement.slice(0, 40000), p.input === null ? null : p.input.slice(0, 2_000_000)],
});
export const insertAttempt = (a: Attempt): Q => ({
  sql: "INSERT INTO coach_attempts (puzzle_key, title, mode, lang, code, result, explanation, mistakes, topics) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
  params: [a.puzzle_key, a.title.slice(0, 200), a.mode, a.lang, a.code.slice(0, 40000), a.result.slice(0, 10000), a.explanation.slice(0, 10000), JSON.stringify(a.mistakes), JSON.stringify(a.topics)],
});
export const recentAttempts = (limit = 400): Q => ({ sql: "SELECT id, puzzle_key, title, mode, lang, result, explanation, mistakes, topics, created_at FROM coach_attempts ORDER BY id DESC LIMIT $1", params: [limit] });
export const recentMistakes = (): Q => ({ sql: "SELECT mistakes FROM coach_attempts WHERE mistakes != '[]' ORDER BY id DESC LIMIT 10", params: [] });

export const COACH_DAILY_KEY = "coach_daily";
export const COACH_TODAY_KEY = "coach_today";
export const COACH_AOC_LAST_KEY = "coach_aoc_last";
export const COACH_NOTE_HOST = "coach.practice";
export const COACH_MODE_KEY = "coach_mode";
export const setNotes = (key: string, notes: string): Q => ({ sql: "UPDATE coach_puzzles SET notes = $2 WHERE key = $1", params: [key, notes.slice(0, 40000)] });
