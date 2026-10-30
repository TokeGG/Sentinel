// Finance plan state in app_settings JSON (no new table): `fin_prefs` (settings) and `fin_plan`
// (goals, dividends, net worth snapshots, which renewals already have a calendar reminder).
import { registry, type SkillDef } from "../../core/module";
import { getSetting, setSetting } from "../../ui/appSetting";
import { listSubs } from "../calendar/extraStore";
import { listBills, listLots } from "./extraStore";
import { parsePrefs, sanitizePrefs, setMoneyFormat, type FinPrefs } from "./prefs";
import { newId, recurringCharges, remindersDue, type Dividend, type Goal } from "./planLogic";
import { addSnapshot, netWorth, type Snap } from "./report";
import { getDb } from "../../core/db";

export type Plan = { goals: Goal[]; dividends: Dividend[]; worth: Snap[]; reminded: string[] };
const PREFS = "fin_prefs", PLAN = "fin_plan";

export async function getPrefs(): Promise<FinPrefs> {
  const p = parsePrefs(await getSetting(PREFS));
  setMoneyFormat(p);
  return p;
}
export async function setPrefs(patch: Partial<FinPrefs>): Promise<FinPrefs> {
  const p = sanitizePrefs({ ...(await getPrefs()), ...patch });
  await setSetting(PREFS, JSON.stringify(p));
  setMoneyFormat(p);
  return p;
}

export async function getPlan(): Promise<Plan> {
  let r: Partial<Plan> = {};
  try { r = JSON.parse((await getSetting(PLAN)) ?? "{}") as Partial<Plan>; } catch { /* default */ }
  const arr = <T>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  return { goals: arr<Goal>(r.goals), dividends: arr<Dividend>(r.dividends), worth: arr<Snap>(r.worth), reminded: arr<string>(r.reminded).slice(-500) };
}
async function edit(fn: (p: Plan) => Plan) { await setSetting(PLAN, JSON.stringify(fn(await getPlan()))); return { ok: true }; }

/** Calendar's own add_item skill (task); absent calendar = no-op. */
export async function toCalendar(args: Record<string, unknown>): Promise<boolean> {
  const add = registry.find((m) => m.id === "hub.calendar")?.skills.find((s) => s.name === "add_item");
  if (!add) return false;
  await add.run({ kind: "task", ...args });
  return true;
}

const str = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown, what: string) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`${what} must be a number`); return n; };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

/** Today's net worth snapshot (holdings at latest prices + cash + goal savings). */
export async function snapshotWorth() {
  const [lots, prefs, plan] = await Promise.all([listLots(), getPrefs(), getPlan()]);
  const prices = new Map((await (await getDb()).select<{ id: number; last_price: number | null }[]>("SELECT id, last_price FROM watchlist")).map((w) => [w.id, w.last_price]));
  const v = netWorth(lots, prices, prefs.cash, plan.goals.reduce((s, g) => s + g.saved, 0));
  await edit((p) => ({ ...p, worth: addSnapshot(p.worth, today(), v) }));
  return { ok: true, value: v };
}

async function renewalReminders() {
  const [subs, bills, prefs, plan] = await Promise.all([listSubs(), listBills(), getPrefs(), getPlan()]);
  const due = remindersDue(recurringCharges(subs, bills, new Date()), plan.reminded, new Date(), prefs.remindDays);
  const done: string[] = [];
  for (const r of due) if (await toCalendar({ title: `Renews: ${r.name} (${r.amount})`, day: r.next, notes: `Subscription renewal, ${r.cycle}` })) done.push(`${r.key}|${r.next}`);
  await edit((p) => ({ ...p, reminded: [...p.reminded, ...done].slice(-500) }));
  return { ok: true, added: done.length };
}

async function addDividend(a?: Record<string, unknown>) {
  const symbol = str(a?.symbol).toUpperCase(), pay = str(a?.pay_on);
  if (!symbol || !DAY.test(pay)) throw new Error("dividend needs a symbol and a YYYY-MM-DD pay date");
  const amount = Number(a?.amount) || 0;
  await edit((p) => ({ ...p, dividends: [...p.dividends, { id: newId(), symbol, pay_on: pay, amount }] }));
  if (a?.toCalendar !== false) await toCalendar({ title: `Dividend: ${symbol}${amount ? ` (${amount})` : ""}`, day: pay });
  return { ok: true };
}

async function addGoal(a?: Record<string, unknown>) {
  const name = str(a?.name);
  if (!name) throw new Error("goal name is empty");
  const by = DAY.test(str(a?.by)) ? str(a?.by) : "";
  return edit((p) => ({ ...p, goals: [...p.goals, { id: newId(), name, target: num(a?.target, "target"), saved: Number(a?.saved) || 0, by }] }));
}

export const planSkills: SkillDef[] = [
  { name: "set_prefs", run: (a) => setPrefs((a ?? {}) as Partial<FinPrefs>) },
  { name: "snapshot_worth", run: snapshotWorth },
  { name: "renewal_reminders", run: renewalReminders },
  { name: "add_dividend", run: addDividend },
  { name: "remove_dividend", run: (a) => edit((p) => ({ ...p, dividends: p.dividends.filter((d) => d.id !== str(a?.id)) })) },
  { name: "add_goal", run: addGoal },
  { name: "goal_deposit", run: (a) => edit((p) => ({ ...p, goals: p.goals.map((g) => (g.id === str(a?.id) ? { ...g, saved: Math.max(0, g.saved + num(a?.amount, "amount")) } : g)) })) },
  { name: "remove_goal", run: (a) => edit((p) => ({ ...p, goals: p.goals.filter((g) => g.id !== str(a?.id)) })) },
];
