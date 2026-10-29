import { PENTEST_STATEMENTS } from "./schemaPentest.ts";
import { SKILLS_STATEMENTS } from "./schemaSkills.ts";
// Bootstrap mirror of src-tauri/migrations/26_social_post_meta.sql (see schema.ts).
export const SOCIAL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS social_post_meta (
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (platform, post_id)
)`,
];

export const LATER_STATEMENTS: string[] = [...PENTEST_STATEMENTS, ...SOCIAL_STATEMENTS, ...SKILLS_STATEMENTS];
