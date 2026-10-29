CREATE TABLE IF NOT EXISTS social_post_meta (
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (platform, post_id)
);
