// Pomodoro stats (pure): focused minutes per day for the last n days and per label.
export interface Session { started_at: string; minutes: number; label: string }
export function lastDays(rows: Session[], now: Date, n = 7): { day: string; minutes: number }[] {
  const out: { day: string; minutes: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ day, minutes: rows.filter((r) => r.started_at.slice(0, 10) === day).reduce((s, r) => s + r.minutes, 0) });
  }
  return out;
}
export function byLabel(rows: Session[], top = 5): { label: string; minutes: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.label || "(no label)", (m.get(r.label || "(no label)") ?? 0) + r.minutes);
  return [...m].map(([label, minutes]) => ({ label, minutes })).sort((a, b) => b.minutes - a.minutes).slice(0, top);
}
