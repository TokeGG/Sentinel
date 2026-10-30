CREATE TABLE IF NOT EXISTS kanban_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board TEXT NOT NULL,
    col TEXT NOT NULL,
    title TEXT NOT NULL,
    pos INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS journal_mood (
    day TEXT PRIMARY KEY,
    mood INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    target_date TEXT NOT NULL DEFAULT '',
    milestones TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS panel_time (
    day TEXT NOT NULL,
    panel_id TEXT NOT NULL,
    secs INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, panel_id)
)
