// Pure export/import bundle: which SQLite tables travel, and the import plan.
// Secrets never live in SQLite (OS keychain), so none can be exported; caches
// that are cheap to refetch are skipped to keep files small.
export type Bundle = { app: "sentinel"; v: 1; at: string; tables: Record<string, Record<string, unknown>[]> };
const SKIP = /^(sqlite_|_sqlx|mail_(messages|bodies|headers)|activity_log|notif_log)/;
const SAFE = /^[a-z_][a-z0-9_]*$/i;
const SECRETISH = /(password|secret|token|api_?key)/i;

export const exportable = (tables: string[]) => tables.filter((t) => SAFE.test(t) && !SKIP.test(t));

/** Drops any column whose name looks like a secret (defence in depth). */
export function scrubRow(r: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(r).filter(([k]) => !SECRETISH.test(k)));
}

export function makeBundle(tables: Record<string, Record<string, unknown>[]>, now: Date): Bundle {
  return { app: "sentinel", v: 1, at: now.toISOString(), tables: Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.map(scrubRow)])) };
}

export function parseBundle(text: string): Bundle {
  const b = JSON.parse(text) as Partial<Bundle>;
  if (b?.app !== "sentinel" || b.v !== 1 || !b.tables || typeof b.tables !== "object") throw new Error("not a Sentinel bundle");
  return b as Bundle;
}

export type ImportStep = { table: string; rows: number; columns: string[] };
/** Preview: only tables that exist here, columns intersected with the local schema. */
export function importPlan(b: Bundle, local: Record<string, string[]>): ImportStep[] {
  const out: ImportStep[] = [];
  for (const [t, rows] of Object.entries(b.tables)) {
    if (!SAFE.test(t) || !local[t] || !Array.isArray(rows)) continue;
    const have = new Set(local[t]);
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r ?? {})))].filter((c) => SAFE.test(c) && have.has(c) && !SECRETISH.test(c));
    if (cols.length) out.push({ table: t, rows: rows.length, columns: cols });
  }
  return out;
}

/** One parameterised INSERT OR REPLACE per row. Identifiers are pre-validated by SAFE. */
export function insertSql(step: ImportStep): string {
  const ph = step.columns.map((_, i) => `$${i + 1}`).join(", ");
  return `INSERT OR REPLACE INTO ${step.table} (${step.columns.join(", ")}) VALUES (${ph})`;
}
