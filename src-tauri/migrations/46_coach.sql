CREATE TABLE IF NOT EXISTS coach_puzzles (
    key TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    statement TEXT NOT NULL,
    input TEXT,
    notes TEXT NOT NULL DEFAULT '',
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS coach_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    puzzle_key TEXT NOT NULL,
    title TEXT NOT NULL,
    mode TEXT NOT NULL,
    lang TEXT NOT NULL,
    code TEXT NOT NULL,
    result TEXT NOT NULL,
    explanation TEXT NOT NULL,
    mistakes TEXT NOT NULL DEFAULT '[]',
    topics TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
