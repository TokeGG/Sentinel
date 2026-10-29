CREATE TABLE IF NOT EXISTS congress_bills (
    id TEXT PRIMARY KEY,
    congress INTEGER,
    number TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '',
    status_label TEXT NOT NULL DEFAULT '',
    status_date TEXT,
    introduced TEXT,
    sponsor TEXT,
    link TEXT,
    history TEXT NOT NULL DEFAULT '[]',
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS congress_votes (
    id TEXT PRIMARY KEY,
    chamber TEXT NOT NULL,
    question TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT '',
    voted_at TEXT,
    yes INTEGER,
    no INTEGER,
    other INTEGER,
    bill TEXT,
    link TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS congress_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    party TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    chamber TEXT NOT NULL DEFAULT '',
    district INTEGER,
    title TEXT,
    link TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS congress_follows (
    kind TEXT NOT NULL,
    ref TEXT NOT NULL,
    label TEXT NOT NULL,
    last_status TEXT NOT NULL DEFAULT '',
    unseen INTEGER NOT NULL DEFAULT 0,
    followed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (kind, ref)
);
