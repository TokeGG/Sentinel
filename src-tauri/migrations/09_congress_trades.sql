
                CREATE TABLE congress_trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chamber TEXT NOT NULL CHECK (chamber IN ('senate', 'house')),
                    politician TEXT NOT NULL,
                    ticker TEXT,
                    transaction_type TEXT,
                    trade_date TEXT,
                    amount_range TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (chamber, politician, ticker, trade_date, transaction_type, amount_range)
                );
            