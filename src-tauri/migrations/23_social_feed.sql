CREATE TABLE IF NOT EXISTS social_feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL,
    name TEXT NOT NULL,
    handle TEXT NOT NULL,
    avatar TEXT,
    text TEXT NOT NULL,
    link TEXT,
    media TEXT NOT NULL DEFAULT '[]',
    likes INTEGER,
    reposts INTEGER,
    replies INTEGER,
    posted_at TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (platform, post_id)
);
