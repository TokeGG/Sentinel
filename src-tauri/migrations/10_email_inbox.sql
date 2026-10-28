
                CREATE TABLE email_inbox (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid INTEGER NOT NULL UNIQUE,
                    sender TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    mail_date TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            