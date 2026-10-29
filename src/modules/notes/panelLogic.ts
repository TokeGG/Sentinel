// Pure helpers for the Notes panel.
type Row = Record<string, unknown>;

/** Unfiled = no (or blank) filed_to; order is preserved. */
export function splitFiled<T extends Row>(rows: T[]): { unfiled: T[]; filed: T[] } {
  const unfiled: T[] = [];
  const filed: T[] = [];
  for (const r of rows) {
    (typeof r.filed_to === "string" && r.filed_to.trim() ? filed : unfiled).push(r);
  }
  return { unfiled, filed };
}

/** Customize sections for the Notes panel; Panel.tsx renders exactly these ids. */
export const notesSections = [
  { id: "capture", label: "Capture box" },
  { id: "inbox", label: "Unfiled notes" },
  { id: "filed", label: "Filed notes", default: false },
];
