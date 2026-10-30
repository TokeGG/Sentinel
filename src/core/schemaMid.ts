// Bootstrap mirror of migrations 17-24 (see schema.ts).
export const MID_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS panel_layout (
    module_id TEXT PRIMARY KEY,
    x REAL,
    y REAL,
    w REAL,
    h REAL,
    z INTEGER,
    state TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS panel_prefs (
    module_id TEXT NOT NULL,
    view TEXT NOT NULL,
    json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (module_id, view)
)`,
  `CREATE TABLE IF NOT EXISTS youtube_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    handle TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS youtube_watched (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    channel_id TEXT,
    title TEXT NOT NULL,
    watched_at TEXT NOT NULL DEFAULT (datetime('now')),
    secs INTEGER,
    UNIQUE (video_id, watched_at)
)`,
  `CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    target TEXT NOT NULL,
    label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS social_feed (
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
)`,
  `CREATE TABLE IF NOT EXISTS mail_accounts (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    preset TEXT NOT NULL DEFAULT 'custom',
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL,
    imap_tls TEXT NOT NULL,
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL,
    smtp_tls TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS mail_folders (
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (account_id, name)
)`,
  `CREATE TABLE IF NOT EXISTS mail_messages (
    account_id TEXT NOT NULL,
    folder TEXT NOT NULL,
    uid INTEGER NOT NULL,
    from_name TEXT NOT NULL,
    from_addr TEXT NOT NULL,
    to_addrs TEXT NOT NULL,
    subject TEXT NOT NULL,
    preview TEXT NOT NULL,
    date_ts INTEGER NOT NULL,
    seen INTEGER NOT NULL,
    starred INTEGER NOT NULL,
    answered INTEGER NOT NULL,
    has_attach INTEGER NOT NULL,
    PRIMARY KEY (account_id, folder, uid)
)`,
  `CREATE TABLE IF NOT EXISTS mail_bodies (
    account_id TEXT NOT NULL,
    folder TEXT NOT NULL,
    uid INTEGER NOT NULL,
    json TEXT NOT NULL,
    PRIMARY KEY (account_id, folder, uid)
)`,
];
