// Scheduled bot jobs: which jobs are due, and the cross-window busy lock. Pure. Jobs run only when BOTH the module's
// Auto-refresh toggle (core/scheduler, off by default) and the job's own `enabled` (default 0) are on.
export interface Job { id: number; name: string; goal: string; workflow_id: number | null; every_minutes: number; enabled: number; last_run: string | null }

/** SQLite datetime('now') text (UTC, "YYYY-MM-DD HH:MM:SS") -> ms; null/garbage -> null. */
export function sqlTime(t: string | null): number | null {
  if (!t) return null;
  const ms = Date.parse(t.includes("T") ? t : t.replace(" ", "T") + "Z");
  return Number.isFinite(ms) ? ms : null;
}

export const MIN_EVERY = 60;
export function dueJobs(jobs: Job[], now: number): Job[] {
  return jobs.filter((j) => {
    if (j.enabled !== 1) return false;
    const last = sqlTime(j.last_run);
    return last === null || now - last >= Math.max(MIN_EVERY, j.every_minutes) * 60_000;
  });
}

/** app_settings `bot_busy` = start time in ms. A lock older than `staleMs` is ignored (a crashed run). */
export const BUSY_KEY = "bot_busy";
export function busyHeld(value: string | null, now: number, staleMs = 15 * 60_000): boolean {
  const t = Number(value);
  return !!value && Number.isFinite(t) && t > 0 && now - t < staleMs;
}

/** One history line for a job run. */
export const jobSummary = (outcome: string, result: string | undefined, steps: number) =>
  `${outcome}, ${steps} steps${result ? `: ${result.replace(/\s+/g, " ").slice(0, 300)}` : ""}`;
