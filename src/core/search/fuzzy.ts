// Pure fuzzy matcher for the command palette: subsequence match with bonuses
// for prefix, word starts and consecutive runs. null = no match.
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  const exact = t.indexOf(q);
  if (exact >= 0) return 1000 - exact * 2 - Math.min(t.length, 200) / 10 + (exact === 0 || /\W/.test(t[exact - 1]) ? 200 : 0);
  let score = 0, ti = 0, run = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    const at = t.indexOf(ch, ti);
    if (at < 0) return null;
    const wordStart = at === 0 || /[\s\-_./]/.test(t[at - 1]);
    run = at === ti ? run + 1 : 0;
    score += 10 + (wordStart ? 15 : 0) + run * 5 - Math.min(at - ti, 10);
    ti = at + 1;
  }
  return score - Math.min(t.length, 200) / 10;
}

export type Scored<T> = { item: T; score: number };

/** Best `limit` items for `query`, using `text(item)` (and an optional per-item boost). */
export function rank<T>(items: T[], query: string, text: (t: T) => string, limit = 50, boost: (t: T) => number = () => 0): T[] {
  const out: Scored<T>[] = [];
  for (const item of items) {
    const s = fuzzyScore(query, text(item));
    if (s !== null) out.push({ item, score: s + boost(item) });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit).map((s) => s.item);
}
