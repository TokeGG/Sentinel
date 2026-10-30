// Bootstrap mirror of src-tauri/migrations/50_calendar_sources.sql (see schema.ts).
export const CALENDAR_SOURCES_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS calendar_item_meta (
    item_id INTEGER PRIMARY KEY,
    url TEXT,
    origin TEXT NOT NULL DEFAULT ''
)`,
  `CREATE TABLE IF NOT EXISTS calendar_subs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    last_fetched TEXT,
    last_count INTEGER NOT NULL DEFAULT 0
)`,
];
