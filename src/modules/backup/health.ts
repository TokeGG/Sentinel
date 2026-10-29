// Pure backup health: how old the last backup is (persisted in app_settings `backup_last`).
export const LAST_KEY = "backup_last";
export type Health = { tone: "ok" | "warn" | "bad"; title: string; advice: string };

export function healthOf(last: Date | null, now: Date, warnDays = 7, badDays = 30): Health {
  if (!last || !Number.isFinite(last.getTime())) return { tone: "bad", title: "Never backed up", advice: "Press Back up now and pick a folder on another drive." };
  const days = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
  const age = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  if (days >= badDays) return { tone: "bad", title: `Last backup ${age}`, advice: "Over a month old: back up now." };
  if (days >= warnDays) return { tone: "warn", title: `Last backup ${age}`, advice: "Over a week old: consider a fresh backup." };
  return { tone: "ok", title: `Last backup ${age}`, advice: "Healthy. Keep a copy on another drive too." };
}

/** Newest of the stored time and this session's snapshots. */
export function latest(stored: string | null, session: (Date | null)[]): Date | null {
  const all = [stored ? new Date(stored) : null, ...session].filter((d): d is Date => !!d && Number.isFinite(d.getTime()));
  return all.length ? new Date(Math.max(...all.map((d) => d.getTime()))) : null;
}
