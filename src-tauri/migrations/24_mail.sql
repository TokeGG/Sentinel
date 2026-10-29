CREATE TABLE IF NOT EXISTS mail_accounts (
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
);
CREATE TABLE IF NOT EXISTS mail_folders (
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (account_id, name)
);
CREATE TABLE IF NOT EXISTS mail_messages (
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
);
CREATE TABLE IF NOT EXISTS mail_bodies (
    account_id TEXT NOT NULL,
    folder TEXT NOT NULL,
    uid INTEGER NOT NULL,
    json TEXT NOT NULL,
    PRIMARY KEY (account_id, folder, uid)
);
