CREATE TABLE IF NOT EXISTS bot_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    start_url TEXT NOT NULL DEFAULT '',
    steps TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'run',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bot_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    workflow_id INTEGER,
    every_minutes INTEGER NOT NULL DEFAULT 1440,
    enabled INTEGER NOT NULL DEFAULT 0,
    last_run TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bot_job_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bot_site_notes (
    host TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
