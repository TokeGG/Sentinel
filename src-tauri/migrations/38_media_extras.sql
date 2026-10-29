CREATE TABLE IF NOT EXISTS mail_meta (
    account_id TEXT NOT NULL,
    folder TEXT NOT NULL,
    uid INTEGER NOT NULL,
    message_id TEXT NOT NULL DEFAULT '',
    in_reply_to TEXT NOT NULL DEFAULT '',
    refs TEXT NOT NULL DEFAULT '',
    unsub TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (account_id, folder, uid)
);
CREATE TABLE IF NOT EXISTS mail_snooze (
    account_id TEXT NOT NULL,
    folder TEXT NOT NULL,
    uid INTEGER NOT NULL,
    until_ts INTEGER NOT NULL,
    PRIMARY KEY (account_id, folder, uid)
);
CREATE TABLE IF NOT EXISTS mail_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field TEXT NOT NULL,
    needle TEXT NOT NULL,
    action TEXT NOT NULL,
    arg TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS mail_drafts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS yt_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS yt_playlist_items (
    playlist_id INTEGER NOT NULL,
    video_id TEXT NOT NULL,
    json TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (playlist_id, video_id)
);
CREATE TABLE IF NOT EXISTS yt_groups (
    name TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    PRIMARY KEY (name, channel_id)
);
CREATE TABLE IF NOT EXISTS yt_speed (
    channel_id TEXT PRIMARY KEY,
    rate REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS yt_progress (
    video_id TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS yt_upload_seen (
    channel_id TEXT PRIMARY KEY,
    seen_ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_users (
    user_key TEXT PRIMARY KEY,
    nick TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS chat_filters (
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (kind, value)
);
CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    user TEXT NOT NULL,
    text TEXT NOT NULL,
    ts INTEGER NOT NULL,
    mention INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS social_lists (
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL,
    PRIMARY KEY (name, platform, handle)
);
CREATE TABLE IF NOT EXISTS social_mutes (
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (kind, value)
);
