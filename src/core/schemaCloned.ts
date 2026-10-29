// Bootstrap mirror of src-tauri/migrations/29_cloned_projects.sql (see schema.ts).
export const CLONED_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS cloned_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_url TEXT NOT NULL,
    full_name TEXT NOT NULL,
    local_path TEXT NOT NULL UNIQUE,
    cloned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_opened TEXT
)`,
];
