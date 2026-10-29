// Pure month-grid model for the Calendar panel: Monday-first weeks covering the
// month of `now`, each cell with how many dated rows fall on that local day.
import { dayKey, isOverdue, rowDate } from "./panelLogic.ts";

type Row = Record<string, unknown>;
export type MonthCell = { key: string; day: number; inMonth: boolean; today: boolean; count: number; overdue: boolean };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthGrid(rows: Row[], now: Date): { title: string; cells: MonthCell[] } {
  const count = new Map<string, number>();
  const late = new Set<string>();
  for (const r of rows) {
    const d = rowDate(r);
    const k = d && dayKey(d);
    if (!k) continue;
    count.set(k, (count.get(k) ?? 0) + 1);
    if (isOverdue(r, now)) late.add(k);
  }
  const y = now.getFullYear();
  const m = now.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday = 0
  const total = Math.ceil((lead + new Date(y, m + 1, 0).getDate()) / 7) * 7;
  const today = dayKey(now);
  const cells = Array.from({ length: total }, (_, i) => {
    const d = new Date(y, m, 1 - lead + i);
    const key = dayKey(d)!;
    return { key, day: d.getDate(), inMonth: d.getMonth() === m, today: key === today, count: count.get(key) ?? 0, overdue: late.has(key) };
  });
  return { title: `${MONTHS[m]} ${y}`, cells };
}
