// Pure Master Hub history search: every word must appear in the module name or date text.
export function filterLog<T extends { at: string; name: string }>(rows: T[], q: string): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => { const t = `${r.name} ${r.at}`.toLowerCase(); return words.every((w) => t.includes(w)); });
}
