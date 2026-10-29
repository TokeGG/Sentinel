-- Non-secret metadata for connected accounts (tokens live in the OS keychain only).
CREATE TABLE IF NOT EXISTS accounts (
    provider TEXT NOT NULL,
    account TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    connected_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_error TEXT,
    PRIMARY KEY (provider, account)
);
