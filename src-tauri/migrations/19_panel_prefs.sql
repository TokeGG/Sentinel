CREATE TABLE panel_prefs (
    module_id TEXT NOT NULL,
    view TEXT NOT NULL,
    json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (module_id, view)
);
