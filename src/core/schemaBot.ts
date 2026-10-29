// Bootstrap mirror of src-tauri/migrations/28_bot.sql (see schema.ts).
export const BOT_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS bot_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'text',
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE TABLE IF NOT EXISTS bot_episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal TEXT NOT NULL,
    outcome TEXT NOT NULL,
    steps INTEGER NOT NULL DEFAULT 0,
    thumbs TEXT,
    json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE TABLE IF NOT EXISTS bot_brain (
    key TEXT PRIMARY KEY,
    json TEXT NOT NULL
)`,
];
