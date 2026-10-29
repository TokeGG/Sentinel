// Weekly "what I learned": a plain summary of the last 7 days of runs and how the brain moved. Pure.
import type { Episode } from "./actions.ts";
import { brainRows } from "./brainOps.ts";
import type { Brain } from "./kernel/brain.ts";
import { detectMistakes, MISTAKE_LABELS, type MistakeKind } from "./mistakes.ts";

export const WEEK_MS = 7 * 24 * 3600_000;
export interface Snapshot { at: number; brain: Brain }

/** Whether the stored brain snapshot is due to roll over (missing, unreadable or a week old). */
export const snapshotDue = (s: Snapshot | null, now: number) => !s || !Number.isFinite(s.at) || now - s.at >= WEEK_MS;

export function weeklySummary(eps: Episode[], now: number, active: Brain, snap: Snapshot | null, siteHosts = 0): string[] {
  const week = eps.filter((e) => now - e.startedAt < WEEK_MS && e.outcome !== "dry");
  if (!week.length) return ["No runs in the last 7 days."];
  const done = week.filter((e) => e.outcome === "done").length;
  const lines = [`${week.length} runs in the last 7 days, ${done} finished (${Math.round((done / week.length) * 100)}%).`];
  const goals = new Map<string, number>();
  for (const e of week) { const g = e.goal.slice(0, 50); goals.set(g, (goals.get(g) ?? 0) + 1); }
  const top = [...goals].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g, n]) => `"${g}" x${n}`);
  lines.push(`Most asked: ${top.join(", ")}.`);
  const m = new Map<MistakeKind, number>();
  for (const e of week) for (const [k, n] of Object.entries(detectMistakes(e)) as [MistakeKind, number][]) m.set(k, (m.get(k) ?? 0) + n);
  const worst = [...m].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  lines.push(worst.length ? `Most common mistakes: ${worst.map(([k, n]) => `${MISTAKE_LABELS[k]} (${n})`).join(", ")}.` : "No mistakes noticed.");
  if (snap) {
    const moved = brainRows(active, snap.brain).filter((r) => r.moved).map((r) => `${r.name} ${r.shipped} -> ${r.active}`);
    lines.push(moved.length ? `Brain changes this week: ${moved.slice(0, 6).join("; ")}.` : "The brain numbers did not move this week.");
  }
  if (siteHosts) lines.push(`Site notebook covers ${siteHosts} site${siteHosts === 1 ? "" : "s"}.`);
  return lines;
}
