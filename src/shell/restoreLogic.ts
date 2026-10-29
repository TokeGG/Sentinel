// Pure: which saved panel rows may be restored. A row whose module no longer exists
// (e.g. the removed x/facebook/instagram panels) is skipped, never an error.
export const keepKnown = <T extends { module_id: string }>(rows: T[], known: Iterable<string>): T[] => {
  const ids = new Set(known);
  return rows.filter((r) => ids.has(r.module_id));
};
