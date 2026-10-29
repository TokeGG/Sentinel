// Bootstrap mirror of src-tauri/migrations/33_notif_log.sql (see schema.ts).
export const NOTIF_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS notif_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    count INTEGER NOT NULL,
    at INTEGER NOT NULL
)`,
];
