CREATE TABLE IF NOT EXISTS taste_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    feature TEXT NOT NULL DEFAULT '[]',
    signal TEXT NOT NULL,
    at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS taste_profile (
    module_id TEXT PRIMARY KEY,
    json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS deal_source_meta (
    url TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'general',
    enabled INTEGER NOT NULL DEFAULT 1
);
