// Pure (no Tauri imports): a TS-side safety net for the tables of migrations
// 17-22. tauri-plugin-sql runs its migration list only inside the first
// `Database.load` per process; if that migrate throws (e.g. a checksum
// mismatch on an old database) later loads succeed WITHOUT migrating and the
// newer tables never appear. db.ts therefore calls ensureSchema() after every
// load. The statements must stay identical to the migration files (schema.test.ts
// enforces it). Migrations 17-22 use CREATE TABLE IF NOT EXISTS so a plugin run
// after this bootstrap does not fail on "already exists"; no database has applied
// 17-19 yet, so editing their text cannot cause a stored-checksum mismatch.
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS panel_layout (
    module_id TEXT PRIMARY KEY,
    x REAL,
    y REAL,
    w REAL,
    h REAL,
    z INTEGER,
    state TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS panel_prefs (
    module_id TEXT NOT NULL,
    view TEXT NOT NULL,
    json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (module_id, view)
)`,
  `CREATE TABLE IF NOT EXISTS youtube_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    handle TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS youtube_watched (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    channel_id TEXT,
    title TEXT NOT NULL,
    watched_at TEXT NOT NULL DEFAULT (datetime('now')),
    secs INTEGER,
    UNIQUE (video_id, watched_at)
)`,
  `CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    target TEXT NOT NULL,
    label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS social_feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL,
    name TEXT NOT NULL,
    handle TEXT NOT NULL,
    avatar TEXT,
    text TEXT NOT NULL,
    link TEXT,
    media TEXT NOT NULL DEFAULT '[]',
    likes INTEGER,
    reposts INTEGER,
    replies INTEGER,
    posted_at TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (platform, post_id)
)`,
];

export async function ensureSchema(exec: (sql: string) => Promise<unknown>): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) await exec(sql);
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
