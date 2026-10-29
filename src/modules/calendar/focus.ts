// Pure focus / pomodoro timing. `focus_until` (app_settings) is an ISO instant; other modules may read it.
export const FOCUS_KEY = "focus_until";
export const PRESETS = [{ label: "Pomodoro 25", minutes: 25 }, { label: "Short break 5", minutes: 5 }, { label: "Long break 15", minutes: 15 }, { label: "Deep 50", minutes: 50 }];

export const focusUntil = (now: Date, minutes: number) => {
  if (!(minutes > 0 && minutes <= 240)) throw new Error("1-240 minutes");
  return new Date(now.getTime() + minutes * 60_000).toISOString();
};

/** Seconds left (0 when over or unset/invalid). */
export function secondsLeft(until: string | null, now: Date): number {
  const t = until ? Date.parse(until) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.ceil((t - now.getTime()) / 1000)) : 0;
}

export const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Total focused minutes on a local day from session rows. */
export const minutesOn = (rows: { started_at: string; minutes: number }[], day: string) =>
  rows.filter((r) => r.started_at.slice(0, 10) === day).reduce((s, r) => s + r.minutes, 0);
