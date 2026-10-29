CREATE TABLE IF NOT EXISTS youtube_watched (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    channel_id TEXT,
    title TEXT NOT NULL,
    watched_at TEXT NOT NULL DEFAULT (datetime('now')),
    secs INTEGER,
    UNIQUE (video_id, watched_at)
);
