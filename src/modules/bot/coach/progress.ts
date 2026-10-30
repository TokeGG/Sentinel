// Progress view numbers, pure: streak of consecutive practice days and topics practised.
export interface AttemptLite { created_at: string; topics: string; mode: string }
const day = (iso: string) => iso.slice(0, 10);

/** Consecutive days with an attempt, ending today or yesterday (UTC dates as stored by SQLite datetime('now')). */
export function streak(dates: string[], today: Date): number {
  const have = new Set(dates.map(day));
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!have.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (have.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}

export function topicCounts(rows: AttemptLite[]): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    let t: unknown = [];
    try { t = JSON.parse(r.topics); } catch { /* bad row */ }
    if (Array.isArray(t)) for (const x of t) if (typeof x === "string" && x) m.set(x, (m.get(x) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const yourTurnCount = (rows: AttemptLite[]) => rows.filter((r) => r.mode === "yours").length;
