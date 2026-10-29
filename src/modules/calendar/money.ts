// Pure expenses + subscriptions maths.
export type Cycle = "weekly" | "monthly" | "yearly";
export const CYCLES: Cycle[] = ["weekly", "monthly", "yearly"];
export type Sub = { id: number; name: string; amount: number; cycle: string; renew_on: string; category: string };
export type Expense = { id: number; day: string; amount: number; category: string; note: string };

const PER_MONTH: Record<Cycle, number> = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 };
export const monthlyCost = (s: Pick<Sub, "amount" | "cycle">) => s.amount * (PER_MONTH[s.cycle as Cycle] ?? 1);
export const round2 = (n: number) => Math.round(n * 100) / 100;

const p2 = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Next renewal on or after today, stepping the stored date by its cycle. */
export function nextRenewal(renewOn: string, cycle: string, now: Date): string {
  const [y, m, d] = renewOn.split("-").map(Number);
  if (!y || !m || !d) return renewOn;
  const today = key(now);
  let i = 0, cur = renewOn;
  while (cur < today && i < 1000) {
    i++;
    const t = cycle === "weekly" ? new Date(y, m - 1, d + 7 * i) : cycle === "yearly" ? new Date(y + i, m - 1, d) : new Date(y, m - 1 + i, d);
    cur = key(t);
  }
  return cur;
}

/** Sum per category for one "YYYY-MM" month, largest first. */
export function byCategory(list: Expense[], month: string): [string, number][] {
  const m = new Map<string, number>();
  for (const e of list) if (e.day.startsWith(month)) m.set(e.category, round2((m.get(e.category) ?? 0) + e.amount));
  return [...m].sort((a, b) => b[1] - a[1]);
}

export function validAmount(s: string): number {
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 1e7) throw new Error("Enter an amount above 0");
  return round2(n);
}
