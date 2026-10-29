CREATE TABLE IF NOT EXISTS game_meta (
    game_key TEXT PRIMARY KEY,
    favorite INTEGER NOT NULL DEFAULT 0,
    last_played TEXT,
    plays INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS game_news (
    appid TEXT NOT NULL,
    guid TEXT NOT NULL,
    title TEXT NOT NULL,
    link TEXT NOT NULL DEFAULT '',
    published TEXT NOT NULL DEFAULT '',
    seen INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (appid, guid)
);
CREATE TABLE IF NOT EXISTS media_shows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tvmaze_id INTEGER,
    name TEXT NOT NULL,
    next_day TEXT,
    next_label TEXT NOT NULL DEFAULT '',
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
