// Pure: net worth snapshots + SVG path, monthly report text, receipt vault search.
import { round2 } from "../calendar/money.ts";

export type Snap = { day: string; value: number };
export const MAX_SNAPS = 400;

/** Adds/replaces today's snapshot (one per day), oldest first, capped. */
export function addSnapshot(list: Snap[], day: string, value: number): Snap[] {
  if (!Number.isFinite(value)) return list;
  return [...list.filter((s) => s.day !== day), { day, value: round2(value) }].sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_SNAPS);
}

/** Net worth = holdings (lots x latest price) + manual cash/other + goal savings. */
export function netWorth(lots: { watch_id: number; qty: number }[], prices: Map<number, number | null>, cash: number, goalsSaved: number): number {
  const held = lots.reduce((s, l) => s + l.qty * (prices.get(l.watch_id) ?? 0), 0);
  return round2(held + cash + goalsSaved);
}

/** SVG polyline points for a w x h box (pad 4); "" for fewer than 2 snapshots. */
export function chartPoints(list: Snap[], w: number, h: number): string {
  if (list.length < 2) return "";
  const vals = list.map((s) => s.value);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  return list.map((s, i) => `${round2(4 + (i / (list.length - 1)) * (w - 8))},${round2(h - 4 - ((s.value - lo) / span) * (h - 8))}`).join(" ");
}

/** Change in net worth across a "YYYY-MM" month: last snapshot in it minus the last one before it (or its first). */
export function monthChange(list: Snap[], month: string): number | null {
  const inside = list.filter((s) => s.day.startsWith(month));
  if (!inside.length) return null;
  const before = list.filter((s) => s.day < `${month}-01`).pop() ?? inside[0];
  return round2(inside[inside.length - 1].value - before.value);
}

/** Copyable plain-text monthly report. `fmt` formats money (currency setting). */
export function monthlyReport(month: string, spent: Map<string, number>, budgets: { category: string; monthly: number }[], change: number | null, subsMonthly: number, fmt: (n: number) => string): string {
  const cats = [...spent.entries()].sort((a, b) => b[1] - a[1]);
  const total = round2(cats.reduce((s, [, v]) => s + v, 0));
  const lines = [`Monthly report ${month}`, "", `Total spent: ${fmt(total)}`];
  for (const [c, v] of cats) {
    const b = budgets.find((x) => x.category === c);
    lines.push(`- ${c || "Uncategorized"}: ${fmt(v)}${b ? ` of ${fmt(b.monthly)}${v > b.monthly ? " (over)" : ""}` : ""}`);
  }
  if (!cats.length) lines.push("- no expenses logged (Calendar > Money)");
  lines.push("", `Subscriptions & recurring bills: ${fmt(subsMonthly)} / month`);
  lines.push(`Net worth change: ${change === null ? "no snapshots this month" : `${change >= 0 ? "+" : ""}${fmt(change)}`}`);
  return lines.join("\n");
}

export type VaultItem = { id: number; name: string; file_name: string; expires_on: string; note: string; added_at?: string };

/** Vault search: every query word must appear in name/file/notes/date; "YYYY" or "YYYY-MM" also matches dates. */
export function searchVault<T extends VaultItem>(items: T[], q: string): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((v) => {
    const hay = `${v.name} ${v.file_name} ${v.note} ${v.expires_on} ${v.added_at ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
