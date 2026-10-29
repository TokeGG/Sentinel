// Bootstrap mirror of src-tauri/migrations/44_knowledge.sql (see schema.ts).
export const KNOWLEDGE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS kb_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'note',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
];
