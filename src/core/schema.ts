// Pure (no Tauri imports): TS-side bootstrap of EVERY table. tauri-plugin-sql
// migrates only inside the first `Database.load` per process; if that throws
// (VersionMismatch etc., see src-tauri/src/db_repair.rs) later loads skip it.
// db.ts runs ensureSchema() after every load in every webview. Entries must
// match the migration files (schema.test.ts creates both in node:sqlite).
import { LATER_STATEMENTS } from "./schemaSocial.ts";
import { BASE_STATEMENTS } from "./schemaBase.ts";
import { MID_STATEMENTS } from "./schemaMid.ts";
import { NEWS_MEDIA_STATEMENTS } from "./schemaNewsMedia.ts";
import { CALENDAR_SOURCES_STATEMENTS } from "./schemaCalendarSources.ts";
import { addColumnSql, tableOf } from "./schemaColumns.ts";
export const SCHEMA_STATEMENTS: string[] = [
  ...BASE_STATEMENTS, // migrations 1-16
  ...MID_STATEMENTS, // migrations 17-24
  ...LATER_STATEMENTS, // migrations 25-48
  ...NEWS_MEDIA_STATEMENTS, // 49
  ...CALENDAR_SOURCES_STATEMENTS, // 50
];

// Never throws: one bad statement must not hide every other table. Returns
// "table: error" for each failure. With `columns` (pragma_table_info) it also
// adds columns missing from tables that already existed.
export async function ensureSchema(
  exec: (sql: string) => Promise<unknown>, columns?: (table: string) => Promise<string[]>,
): Promise<string[]> {
  const failed: string[] = [];
  const run = async (sql: string) => {
    try { await exec(sql); } catch (e) { failed.push(`${tableOf(sql)}: ${e instanceof Error ? e.message : String(e)}`); }
  };
  for (const sql of SCHEMA_STATEMENTS) await run(sql);
  if (columns) for (const sql of SCHEMA_STATEMENTS) {
    let have: string[] = [];
    try { have = await columns(tableOf(sql)); } catch { continue; }
    for (const alter of addColumnSql(sql, have)) await run(alter);
  }
  return failed;
}

// Error text may hold a user-profile path; keep the name out of banners/reports.
export function redactPaths(text: string): string {
  return text
    .replace(/([a-z]:[\\/]+Users[\\/]+)[^\\/\s'":]+/gi, "$1<user>")
    .replace(/(\/(?:home|Users)\/)[^\\/\s'":]+/g, "$1<user>");
}

export interface DbDiagnostics {
  loadProblem: string | null;
  loadProblemSource: "this webview" | "main window at startup" | null;
  migrations: { version: number; description: string; success: boolean; checksum: string }[];
  tables: string[];
  error: string | null;
}

// Plain-text report for the Settings "Copy report" button (no secrets in it).
export function describeDb(d: DbDiagnostics): string {
  const lines = [
    "Sentinel database check",
    `Load problem: ${d.loadProblem ? `${redactPaths(d.loadProblem)} (${d.loadProblemSource ?? "unknown source"})` : "none"}`,
    `Query error: ${d.error ?? "none"}`,
    "Applied migrations (version description status checksum):",
    ...(d.migrations.length
      ? d.migrations.map((m) => `${m.version} ${m.description} ${m.success ? "ok" : "FAILED"} ${m.checksum}`)
      : ["(none)"]),
    `Tables: ${d.tables.length ? d.tables.join(", ") : "(none)"}`,
  ];
  return lines.join("\n");
}
