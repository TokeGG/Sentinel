// SQLite side of Notes productivity (migration 48): kanban cards, journal mood, goals.
import { getDb } from "../../core/db";
import type { Col, KCard, Milestone, Mood } from "./prod";

const all = async <T,>(sql: string, args: unknown[] = []) => (await getDb()).select<T[]>(sql, args);
const run = async (sql: string, args: unknown[]) => void (await (await getDb()).execute(sql, args));

export const listCards = () => all<KCard>("SELECT id, board, col, title, pos FROM kanban_cards ORDER BY pos");
export const addCard = (board: string, col: Col, title: string, pos: number) => run("INSERT INTO kanban_cards (board, col, title, pos) VALUES ($1,$2,$3,$4)", [board.slice(0, 60), col, title.slice(0, 300), pos]);
export const moveCard = (id: number, col: Col, pos: number) => run("UPDATE kanban_cards SET col = $2, pos = $3 WHERE id = $1", [id, col, pos]);
export const deleteCard = (id: number) => run("DELETE FROM kanban_cards WHERE id = $1", [id]);

export const listMoods = () => all<Mood>("SELECT day, mood, note FROM journal_mood ORDER BY day DESC LIMIT 60");
export const setMood = (day: string, mood: number, note: string) =>
  run("INSERT INTO journal_mood (day, mood, note) VALUES ($1,$2,$3) ON CONFLICT(day) DO UPDATE SET mood = $2, note = $3", [day, mood, note.slice(0, 300)]);

export type GoalRow = { id: number; title: string; target_date: string; milestones: string };
export const listGoals = () => all<GoalRow>("SELECT id, title, target_date, milestones FROM goals ORDER BY id DESC");
export const addGoal = (title: string, target: string, ms: Milestone[]) => run("INSERT INTO goals (title, target_date, milestones) VALUES ($1,$2,$3)", [title.slice(0, 200), target, JSON.stringify(ms)]);
export const saveMilestones = (id: number, ms: Milestone[]) => run("UPDATE goals SET milestones = $2 WHERE id = $1", [id, JSON.stringify(ms)]);
export const deleteGoal = (id: number) => run("DELETE FROM goals WHERE id = $1", [id]);
