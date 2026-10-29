CREATE TABLE IF NOT EXISTS accounts (
    provider TEXT NOT NULL,
    account TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    connected_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_error TEXT,
    PRIMARY KEY (provider, account)
);
