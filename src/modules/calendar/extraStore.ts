// SQLite side of the Calendar tabs (migration 37): reminders, habits, focus, contacts,
// subscriptions, expenses, bookmarks, time blocks. No secrets here.
import { getDb } from "../../core/db";
import type { Block } from "./views";
import type { Reminder } from "./reminders";
import type { Contact } from "./vcard";
import type { Expense, Sub } from "./money";
import type { Bookmark } from "./bookmarks";

const all = async <T,>(sql: string, args: unknown[] = []) => (await getDb()).select<T[]>(sql, args);
const run = async (sql: string, args: unknown[] = []) => void (await (await getDb()).execute(sql, args));
const del = (table: string) => (id: number) => run(`DELETE FROM ${table} WHERE id = $1`, [id]);

export const listReminders = () => all<Reminder>("SELECT * FROM reminders ORDER BY done, due_at");
export const addReminder = (title: string, due: string) => run("INSERT INTO reminders (title, due_at) VALUES ($1,$2)", [title, due]);
export const snoozeReminder = (id: number, due: string) => run("UPDATE reminders SET due_at = $2 WHERE id = $1", [id, due]);
export const doneReminder = (id: number) => run("UPDATE reminders SET done = 1 WHERE id = $1", [id]);
export const deleteReminder = del("reminders");

export type Habit = { id: number; name: string; days: string[] };
export async function listHabits(): Promise<Habit[]> {
  const hs = await all<{ id: number; name: string }>("SELECT id, name FROM habits ORDER BY id");
  const checks = await all<{ habit_id: number; day: string }>("SELECT habit_id, day FROM habit_checks");
  return hs.map((h) => ({ ...h, days: checks.filter((c) => c.habit_id === h.id).map((c) => c.day) }));
}
export const addHabit = (name: string) => run("INSERT INTO habits (name) VALUES ($1)", [name]);
export async function deleteHabit(id: number) { await run("DELETE FROM habit_checks WHERE habit_id = $1", [id]); await del("habits")(id); }
export const toggleCheck = (id: number, day: string, on: boolean) =>
  on ? run("INSERT INTO habit_checks (habit_id, day) VALUES ($1,$2) ON CONFLICT DO NOTHING", [id, day]) : run("DELETE FROM habit_checks WHERE habit_id = $1 AND day = $2", [id, day]);

export const listFocus = () => all<{ id: number; started_at: string; minutes: number; label: string }>("SELECT * FROM focus_sessions ORDER BY id DESC LIMIT 200");
export const logFocus = (startedAt: string, minutes: number, label: string) => run("INSERT INTO focus_sessions (started_at, minutes, label) VALUES ($1,$2,$3)", [startedAt, minutes, label]);

export type ContactRow = Contact & { id: number };
export const listContacts = () => all<ContactRow>("SELECT * FROM contacts ORDER BY name");
export async function addContacts(list: Contact[]): Promise<number> {
  const have = new Set((await listContacts()).map((c) => `${c.name}|${c.emails}`));
  let n = 0;
  for (const c of list) {
    if (have.has(`${c.name}|${c.emails}`)) continue;
    await run("INSERT INTO contacts (name, emails, phones, birthday, notes) VALUES ($1,$2,$3,$4,$5)", [c.name, c.emails, c.phones, c.birthday, c.notes]);
    n++;
  }
  return n;
}
export const deleteContact = del("contacts");

export const listSubs = () => all<Sub>("SELECT * FROM subscriptions ORDER BY renew_on");
export const addSub = (s: Omit<Sub, "id">) => run("INSERT INTO subscriptions (name, amount, cycle, renew_on, category) VALUES ($1,$2,$3,$4,$5)", [s.name, s.amount, s.cycle, s.renew_on, s.category]);
export const deleteSub = del("subscriptions");
export const listExpenses = () => all<Expense>("SELECT * FROM expenses ORDER BY day DESC, id DESC LIMIT 500");
export const addExpense = (e: Omit<Expense, "id">) => run("INSERT INTO expenses (day, amount, category, note) VALUES ($1,$2,$3,$4)", [e.day, e.amount, e.category, e.note]);
export const deleteExpense = del("expenses");

export const listBookmarks = () => all<Bookmark>("SELECT * FROM bookmarks ORDER BY read, id DESC");
export const addBookmark = (url: string, title: string, tags: string) =>
  run("INSERT INTO bookmarks (url, title, tags) VALUES ($1,$2,$3) ON CONFLICT(url) DO UPDATE SET title = $2, tags = $3", [url, title, tags]);
export const setRead = (id: number, read: boolean) => run("UPDATE bookmarks SET read = $2 WHERE id = $1", [id, read ? 1 : 0]);
export const deleteBookmark = del("bookmarks");

export const listBlocks = () => all<Block & { id: number }>("SELECT * FROM time_blocks ORDER BY day, start_min");
export const addBlock = (b: Block) => run("INSERT INTO time_blocks (day, start_min, end_min, title) VALUES ($1,$2,$3,$4)", [b.day, b.start_min, b.end_min, b.title]);
export const deleteBlock = del("time_blocks");
