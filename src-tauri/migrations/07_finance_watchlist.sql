
                CREATE TABLE watchlist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK (kind IN ('stock', 'crypto')),
                    last_price REAL,
                    last_checked TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (symbol, kind)
                );
            