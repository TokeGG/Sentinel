// Bootstrap mirror of src-tauri/migrations/32_calendar_items.sql (see schema.ts).
export const CALENDAR_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS calendar_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    starts_at TEXT,
    ends_at TEXT,
    all_day INTEGER NOT NULL DEFAULT 0,
    rrule TEXT,
    notes TEXT NOT NULL DEFAULT '',
    done INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER,
    uid TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
];
