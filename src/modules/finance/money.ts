// Pure Finance extras: alert checks, lot gain/loss, budgets vs spend, upcoming bills, expiring vault items.
import { nextRenewal } from "../calendar/money.ts";

export type Alert = { id: number; watch_id: number; dir: string; price: number; fired: number };
export type Lot = { id: number; watch_id: number; qty: number; cost: number; bought_on: string };

/** Ids of not-yet-fired alerts whose condition holds at the given prices (by watch id). */
export function alertsToFire(alerts: Alert[], prices: Map<number, number | null>): number[] {
  return alerts.filter((a) => {
    if (a.fired) return false;
    const p = prices.get(a.watch_id);
    if (p == null || !Number.isFinite(p)) return false;
    return a.dir === "below" ? p <= a.price : p >= a.price;
  }).map((a) => a.id);
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Totals for lots at a current price; cost = per-unit cost. gain/pct null without a price. */
export function lotSummary(lots: Pick<Lot, "qty" | "cost">[], price: number | null) {
  const qty = lots.reduce((s, l) => s + l.qty, 0);
  const cost = r2(lots.reduce((s, l) => s + l.qty * l.cost, 0));
  if (price === null) return { qty, cost, value: null, gain: null, pct: null };
  const value = r2(qty * price);
  const gain = r2(value - cost);
  return { qty, cost, value, gain, pct: cost > 0 ? r2((gain / cost) * 100) : null };
}

/** Budget rows for a month: spent from expenses by category vs target. */
export function budgetStatus(budgets: { category: string; monthly: number }[], spent: Map<string, number>) {
  return budgets.map((b) => {
    const s = r2(spent.get(b.category) ?? 0);
    return { category: b.category, monthly: b.monthly, spent: s, left: r2(b.monthly - s), over: s > b.monthly, pct: b.monthly > 0 ? Math.min(100, Math.round((s / b.monthly) * 100)) : 0 };
  });
}

export type Bill = { id: number; name: string; amount: number; due_on: string; cycle: string };
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Bills with their next due date (recurring ones roll forward), soonest first, flagged when due within `soon` days. */
export function upcomingBills(bills: Bill[], now: Date, soon = 3) {
  const limit = dayKey(addDays(now, soon));
  return bills
    .map((b) => {
      const next = b.cycle === "once" ? b.due_on : nextRenewal(b.due_on, b.cycle, now);
      return { ...b, next, soon: next >= dayKey(now) && next <= limit, past: next < dayKey(now) };
    })
    .sort((a, b) => a.next.localeCompare(b.next));
}

/** Vault items whose expiry is within `days` (or past): "expired" | "soon" | null. */
export function expiryState(expires: string, now: Date, days = 30): "expired" | "soon" | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) return null;
  if (expires < dayKey(now)) return "expired";
  return expires <= dayKey(addDays(now, days)) ? "soon" : null;
}

/** Calendar repeat for a bill cycle (calendar supports daily/weekly/monthly; yearly/once -> none). */
export const calendarRepeat = (cycle: string) => (cycle === "weekly" || cycle === "monthly" ? cycle : "none");

export const BILL_CYCLES = ["monthly", "weekly", "yearly", "once"];
export const MAX_VAULT_BYTES = 2_000_000;
