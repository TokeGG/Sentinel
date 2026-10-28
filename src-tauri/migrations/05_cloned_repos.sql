
                CREATE TABLE cloned_repos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repo TEXT NOT NULL,
                    dest_dir TEXT NOT NULL,
                    cloned_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            