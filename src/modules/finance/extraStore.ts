// Finance extras in SQLite (migration 39): groups, alerts (counts-only moon), lots, budgets, bills, vault.
// Budgets read spend from the calendar's `expenses` table (Calendar > Money) instead of a second ledger.
import { getDb } from "../../core/db";
import { registry, type SkillDef } from "../../core/module";
import { alertsToFire, calendarRepeat, MAX_VAULT_BYTES, type Alert } from "./money";

const db = getDb;
const num = (v: unknown, what: string) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${what} must be a number`);
  return n;
};
const str = (v: unknown) => String(v ?? "").trim();
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Fires alerts whose condition now holds; returns how many fired. */
export async function checkAlerts(): Promise<number> {
  const d = await db();
  const alerts = await d.select<Alert[]>("SELECT * FROM fin_alerts WHERE fired = 0");
  const prices = new Map((await d.select<{ id: number; last_price: number | null }[]>("SELECT id, last_price FROM watchlist")).map((w) => [w.id, w.last_price]));
  const ids = alertsToFire(alerts, prices);
  for (const id of ids) await d.execute("UPDATE fin_alerts SET fired = 1, seen = 0 WHERE id = $1", [id]);
  return ids.length;
}

export async function unseenAlerts(): Promise<number> {
  const r = await (await db()).select<{ n: number }[]>("SELECT COUNT(*) AS n FROM fin_alerts WHERE fired = 1 AND seen = 0");
  return Number(r[0]?.n ?? 0);
}

export const listAlerts = async () => (await db()).select<(Alert & { seen: number })[]>("SELECT * FROM fin_alerts ORDER BY id");
export const listLots = async () => (await db()).select<{ id: number; watch_id: number; qty: number; cost: number; bought_on: string }[]>("SELECT * FROM fin_lots ORDER BY bought_on, id");
export const listBudgets = async () => (await db()).select<{ category: string; monthly: number }[]>("SELECT * FROM fin_budgets ORDER BY category");
export const listBills = async () => (await db()).select<{ id: number; name: string; amount: number; due_on: string; cycle: string }[]>("SELECT * FROM fin_bills");
export const listVault = async () => (await db()).select<{ id: number; name: string; file_name: string; data_url: string; expires_on: string; note: string }[]>("SELECT * FROM fin_vault ORDER BY expires_on, name");

/** Spend per category for "YYYY-MM" from Calendar's expenses (empty when that table is absent). */
export async function spentByCategory(month: string): Promise<Map<string, number>> {
  try {
    const rows = await (await db()).select<{ category: string; total: number }[]>("SELECT category, SUM(amount) AS total FROM expenses WHERE day LIKE $1 GROUP BY category", [`${month}%`]);
    return new Map(rows.map((r) => [r.category, Number(r.total)]));
  } catch {
    return new Map();
  }
}

const exec = async (sql: string, args: unknown[]) => { await (await db()).execute(sql, args); return { ok: true }; };

async function addBill(a?: Record<string, unknown>) {
  const name = str(a?.name);
  const due = str(a?.due_on);
  if (!name || !DAY.test(due)) throw new Error("bill needs a name and a YYYY-MM-DD due date");
  const cycle = ["monthly", "weekly", "yearly", "once"].includes(str(a?.cycle)) ? str(a?.cycle) : "monthly";
  const amount = Number(a?.amount) || 0;
  await exec("INSERT INTO fin_bills (name, amount, due_on, cycle) VALUES ($1,$2,$3,$4)", [name, amount, due, cycle]);
  // Feed the calendar agenda through Calendar's own add_item skill (task on the due date).
  const add = registry.find((m) => m.id === "hub.calendar")?.skills.find((s) => s.name === "add_item");
  if (a?.toCalendar !== false && add) await add.run({ kind: "task", title: `Bill: ${name}${amount ? ` ($${amount})` : ""}`, day: due, repeat: calendarRepeat(cycle) });
  return { ok: true };
}

async function addVault(a?: Record<string, unknown>) {
  const name = str(a?.name);
  if (!name) throw new Error("name is empty");
  const data = str(a?.data_url);
  if (data && (!/^data:[\w.+/-]+;base64,/.test(data) || data.length > MAX_VAULT_BYTES * 1.4)) throw new Error("attachment must be a file under 2 MB");
  const exp = str(a?.expires_on);
  if (exp && !DAY.test(exp)) throw new Error("expiry must be YYYY-MM-DD");
  return exec("INSERT INTO fin_vault (name, file_name, data_url, expires_on, note) VALUES ($1,$2,$3,$4,$5)", [name, str(a?.file_name), data, exp, str(a?.note)]);
}

export const extraSkills: SkillDef[] = [
  { name: "set_group", run: (a) => (str(a?.group) ? exec("INSERT INTO fin_groups (watch_id, grp) VALUES ($1,$2) ON CONFLICT(watch_id) DO UPDATE SET grp = $2", [num(a?.id, "id"), str(a?.group).slice(0, 30)]) : exec("DELETE FROM fin_groups WHERE watch_id = $1", [num(a?.id, "id")])) },
  { name: "add_alert", run: (a) => exec("INSERT INTO fin_alerts (watch_id, dir, price) VALUES ($1,$2,$3)", [num(a?.id, "id"), a?.dir === "below" ? "below" : "above", num(a?.price, "price")]) },
  { name: "remove_alert", run: (a) => exec("DELETE FROM fin_alerts WHERE id = $1", [num(a?.id, "id")]) },
  { name: "mark_alerts_seen", run: () => exec("UPDATE fin_alerts SET seen = 1 WHERE fired = 1", []) },
  { name: "add_lot", run: (a) => exec("INSERT INTO fin_lots (watch_id, qty, cost, bought_on) VALUES ($1,$2,$3,$4)", [num(a?.id, "id"), num(a?.qty, "qty"), num(a?.cost, "cost"), str(a?.bought_on)]) },
  { name: "remove_lot", run: (a) => exec("DELETE FROM fin_lots WHERE id = $1", [num(a?.id, "id")]) },
  { name: "set_budget", run: (a) => (str(a?.category) ? exec("INSERT OR REPLACE INTO fin_budgets (category, monthly) VALUES ($1,$2)", [str(a?.category), num(a?.monthly, "monthly")]) : Promise.reject(new Error("category is empty"))) },
  { name: "remove_budget", run: (a) => exec("DELETE FROM fin_budgets WHERE category = $1", [str(a?.category)]) },
  { name: "add_bill", run: addBill },
  { name: "remove_bill", run: (a) => exec("DELETE FROM fin_bills WHERE id = $1", [num(a?.id, "id")]) },
  { name: "add_vault", run: addVault },
  { name: "remove_vault", run: (a) => exec("DELETE FROM fin_vault WHERE id = $1", [num(a?.id, "id")]) },
];
