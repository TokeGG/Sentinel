// Pure planning maths: subscription tracker, renewal reminders, "can I afford it", savings goals, dividends.
import { monthlyCost, nextRenewal, round2 } from "../calendar/money.ts";

export type Recurring = { key: string; name: string; amount: number; cycle: string; next: string; monthly: number; from: "subscription" | "bill"; category: string };
type SubIn = { id: number; name: string; amount: number; cycle: string; renew_on: string; category: string };
type BillIn = { id: number; name: string; amount: number; due_on: string; cycle: string };

/** Calendar subscriptions (manual) + recurring Finance bills as one list, soonest renewal first. */
export function recurringCharges(subs: SubIn[], bills: BillIn[], now: Date): Recurring[] {
  const a: Recurring[] = subs.map((s) => ({ key: `s${s.id}`, name: s.name, amount: s.amount, cycle: s.cycle, next: nextRenewal(s.renew_on, s.cycle, now), monthly: round2(monthlyCost(s)), from: "subscription", category: s.category || "Bills" }));
  const b: Recurring[] = bills.filter((x) => x.cycle !== "once").map((x) => ({ key: `b${x.id}`, name: x.name, amount: x.amount, cycle: x.cycle, next: nextRenewal(x.due_on, x.cycle, now), monthly: round2(monthlyCost(x)), from: "bill", category: "Bills" }));
  return [...a, ...b].sort((x, y) => x.next.localeCompare(y.next) || x.name.localeCompare(y.name));
}

export const monthlyTotal = (list: { monthly: number }[]) => round2(list.reduce((s, r) => s + r.monthly, 0));

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Renewals within `days` that have no reminder yet (reminder id = key|date). */
export function remindersDue(list: Recurring[], reminded: string[], now: Date, days: number): Recurring[] {
  const from = dayKey(now), to = dayKey(new Date(now.getTime() + days * 86400000));
  const have = new Set(reminded);
  return list.filter((r) => r.next >= from && r.next <= to && !have.has(`${r.key}|${r.next}`));
}

export type Afford = { ok: boolean; left: number; after: number; reason: string };

/** Can `price` come out of `category`'s budget this month (and the whole budget)? */
export function canAfford(price: number, category: string, budgets: { category: string; monthly: number }[], spent: Map<string, number>): Afford {
  if (!(price > 0)) return { ok: false, left: 0, after: 0, reason: "Enter a price above zero." };
  const b = budgets.find((x) => x.category === category);
  if (!b) {
    const total = budgets.reduce((s, x) => s + x.monthly, 0);
    const used = budgets.reduce((s, x) => s + (spent.get(x.category) ?? 0), 0);
    const left = round2(total - used);
    if (!budgets.length) return { ok: false, left: 0, after: 0, reason: "Set a budget first (Budgets tab)." };
    return { ok: price <= left, left, after: round2(left - price), reason: `No budget for "${category}"; compared with what is left across all budgets.` };
  }
  const left = round2(b.monthly - (spent.get(category) ?? 0));
  return { ok: price <= left, left, after: round2(left - price), reason: price <= left ? `Fits in ${category} this month.` : `Over the ${category} budget this month.` };
}

export type Goal = { id: string; name: string; target: number; saved: number; by: string };

/** Progress, remaining and the monthly amount needed to hit the target date (null without a date). */
export function goalProgress(g: Goal, now: Date) {
  const left = round2(Math.max(0, g.target - g.saved));
  const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.by)) return { left, pct, perMonth: null };
  const [y, m] = g.by.split("-").map(Number);
  const months = Math.max(1, (y - now.getUTCFullYear()) * 12 + (m - 1 - now.getUTCMonth()));
  return { left, pct, perMonth: round2(left / months) };
}

export type Dividend = { id: string; symbol: string; pay_on: string; amount: number };
/** Upcoming dividends (on or after today), soonest first. */
export const upcomingDividends = (list: Dividend[], now: Date) => list.filter((d) => d.pay_on >= dayKey(now)).sort((a, b) => a.pay_on.localeCompare(b.pay_on));

/** Short random-ish id for JSON-stored rows. */
export const newId = (now = Date.now()) => `${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
