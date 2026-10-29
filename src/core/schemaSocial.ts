import { PENTEST_STATEMENTS } from "./schemaPentest.ts";
import { SKILLS_STATEMENTS } from "./schemaSkills.ts";
import { BOT_STATEMENTS } from "./schemaBot.ts";
import { CLONED_STATEMENTS } from "./schemaCloned.ts";
import { YOUTUBE_STATEMENTS } from "./schemaYoutube.ts";
import { CONGRESS_STATEMENTS } from "./schemaCongress.ts";
import { CALENDAR_STATEMENTS } from "./schemaCalendar.ts";
import { LAB_STATEMENTS } from "./schemaLab.ts";
import { NOTIF_STATEMENTS } from "./schemaNotif.ts";
import { TASTE_STATEMENTS } from "./schemaTaste.ts";
// Bootstrap mirror of src-tauri/migrations/26_social_post_meta.sql (see schema.ts).
export const SOCIAL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS social_post_meta (
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (platform, post_id)
)`,
];

export const LATER_STATEMENTS: string[] = [...PENTEST_STATEMENTS, ...SOCIAL_STATEMENTS, ...SKILLS_STATEMENTS, ...BOT_STATEMENTS, ...CLONED_STATEMENTS, ...YOUTUBE_STATEMENTS, ...CONGRESS_STATEMENTS, ...CALENDAR_STATEMENTS, ...NOTIF_STATEMENTS, ...LAB_STATEMENTS, ...TASTE_STATEMENTS];
