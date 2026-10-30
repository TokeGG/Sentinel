import type Database from "@tauri-apps/plugin-sql";
import { ensureSchema, redactPaths, type DbDiagnostics } from "./schema.ts";

// The Tauri plugin is imported lazily so node tests can load this file.
export interface DbDeps {
  load: () => Promise<Database>;
}
const defaults: DbDeps = {
  load: async () => (await import("@tauri-apps/plugin-sql")).default.load("sqlite:sentinel.db"),
};

let loading: Promise<Database> | null = null;
let loadProblem: string | null = null;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function getLoadProblem(): string | null {
  return loadProblem;
}

export function resetDbForTests() {
  loading = null;
  loadProblem = null;
}

// tauri-plugin-sql runs the migrations only inside the FIRST `load` call (and
// then drops the list); an overlapping second load returns at once, before the
// new tables exist. So every caller shares one load promise (cleared on failure
// so it can retry). If the first load rejects (its migrate failed) we remember
// why and retry once - the plugin's second load succeeds without migrating -
// then ensureSchema() creates what the failed migrations should have.
export function getDb(deps: DbDeps = defaults): Promise<Database> {
  loading ??= (async () => {
    loadProblem = null;
    let db: Database;
    try {
      db = await deps.load();
    } catch (e) {
      loadProblem = msg(e);
      db = await deps.load();
    }
    await ensureSchema((sql) => db.execute(sql));
    return db;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

const PROBLEM_KEY = "db_load_problem";

// The Settings panel is another webview with its own getLoadProblem(), so the
// MAIN window stores the startup problem (redacted) in app_settings for it.
export async function recordLoadProblem(deps: DbDeps = defaults): Promise<void> {
  try {
    const d = await getDb(deps);
    if (loadProblem) {
      await d.execute(
        "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [PROBLEM_KEY, redactPaths(loadProblem)]
      );
    } else {
      await d.execute("DELETE FROM app_settings WHERE key = $1", [PROBLEM_KEY]);
    }
  } catch {
    // Diagnostics only; never break startup.
  }
}

// Read-only; backs Settings > Database check.
export async function getDbDiagnostics(deps: DbDeps = defaults): Promise<DbDiagnostics> {
  const d = await getDb(deps);
  let error: string | null = null;
  let migrations: DbDiagnostics["migrations"] = [];
  try {
    const rows = await d.select<{ version: number; description: string; success: number | boolean; checksum: string | null }[]>(
      "SELECT version, description, success, hex(checksum) AS checksum FROM _sqlx_migrations ORDER BY version"
    );
    migrations = rows.map((r) => ({
      version: r.version, description: r.description, success: !!r.success, checksum: (r.checksum ?? "").slice(0, 12),
    }));
  } catch (e) {
    error = msg(e);
  }
  const t = await d.select<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  let persisted: string | null = null;
  try {
    const r = await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [PROBLEM_KEY]);
    persisted = r[0]?.value ?? null;
  } catch {
    persisted = null;
  }
  const problem = loadProblem ?? persisted;
  const loadProblemSource = loadProblem ? "this webview" : persisted ? "main window at startup" : null;
  return {
    loadProblem: problem && redactPaths(problem), loadProblemSource,
    migrations, tables: t.map((r) => r.name), error,
  };
}

// The shared activity log every module writes to (Core Architecture: "what
// did it do" is always answerable from one place).
export async function logActivity(
  module: string,
  skill: string,
  summary: string,
  result: string
) {
  const d = await getDb();
  await d.execute(
    // Incognito session (Settings > Privacy): nothing is written while sys_prefs has "incognito":true.
    "INSERT INTO activity_log (module, skill, summary, result) SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'sys_prefs' AND value LIKE '%\"incognito\":true%')",
    [module, skill, summary, result]
  );
}
