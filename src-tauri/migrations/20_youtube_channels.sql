CREATE TABLE IF NOT EXISTS youtube_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    handle TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
