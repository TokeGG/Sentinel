// Bootstrap mirror of src-tauri/migrations/47_study.sql (Lab study: mistake journal, mock exams; see schema.ts).
export const STUDY_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS lab_mistakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    topic TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS lab_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    secs INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
];
