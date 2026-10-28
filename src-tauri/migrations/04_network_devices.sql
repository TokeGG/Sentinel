
                CREATE TABLE network_devices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip TEXT NOT NULL,
                    mac TEXT NOT NULL,
                    tag TEXT,
                    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (mac)
                );
            