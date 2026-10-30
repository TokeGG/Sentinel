// Pure: history auto-clear (opt-in, runs once at startup) and the diagnostic report text.
import { redactPaths } from "../../core/schema.ts";

export interface PurgeStep { sql: string; args: (string | number)[] }

/** Deletes history older than `days`. days <= 0 = off (no steps). */
export function purgeSteps(days: number, nowMs: number): PurgeStep[] {
  if (!(days > 0)) return [];
  const cut = `-${Math.floor(days)} days`;
  return [
    { sql: "DELETE FROM activity_log WHERE created_at < datetime('now', $1)", args: [cut] },
    { sql: "DELETE FROM notif_log WHERE at < $1", args: [nowMs - Math.floor(days) * 86_400_000] },
    { sql: "DELETE FROM browser_history WHERE visited < datetime('now', $1)", args: [cut] },
    { sql: "DELETE FROM youtube_seen WHERE last_at < datetime('now', $1)", args: [cut] },
  ];
}

export interface LogRow { id: number; module: string; skill: string; summary: string; result: string; created_at: string }

export function filterLog(rows: LogRow[], q: string, module: string): LogRow[] {
  const s = q.trim().toLowerCase();
  return rows.filter((r) => (!module || r.module === module)
    && (!s || `${r.module} ${r.skill} ${r.summary} ${r.result}`.toLowerCase().includes(s)));
}

export const logModules = (rows: LogRow[]) => [...new Set(rows.map((r) => r.module))].sort();

export interface ReportInput {
  version: string; userAgent: string; at: string; tables: string[]; migrations: number[];
  loadProblem: string | null; log: LogRow[]; prefs: Record<string, unknown>;
}

const looksBad = (r: LogRow) => /error|fail|denied|refused/i.test(`${r.result} ${r.summary}`);

/** Plain-text report for the user to save. Paths are redacted; no secrets live in these inputs. */
export function buildReport(i: ReportInput): string {
  const errs = i.log.filter(looksBad).slice(0, 50);
  const lines = [
    "Sentinel diagnostic report", `Created: ${i.at}`, `Version: ${i.version}`, `Platform: ${i.userAgent}`,
    `DB load problem: ${i.loadProblem ?? "none"}`, `Migrations applied: ${i.migrations.join(", ") || "unknown"}`,
    `Tables (${i.tables.length}): ${i.tables.join(", ")}`, `Settings: ${JSON.stringify(i.prefs)}`,
    "", `Recent problems (${errs.length}):`, ...errs.map((r) => `${r.created_at} ${r.module}/${r.skill}: ${r.summary} -> ${r.result}`),
    "", "Last 30 actions:", ...i.log.slice(0, 30).map((r) => `${r.created_at} ${r.module}/${r.skill}: ${r.result}`),
  ];
  return redactPaths(lines.join("\n"));
}
