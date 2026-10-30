import { PCNET_STATEMENTS } from "./schemaPcNet.ts";
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
import { PRODUCTIVITY_STATEMENTS } from "./schemaProductivity.ts";
import { ACCOUNTS_STATEMENTS } from "./schemaAccounts.ts";
import { MEDIA_STATEMENTS } from "./schemaMedia.ts";
import { FEEDS_STATEMENTS } from "./schemaFeeds.ts";
import { BOT_EXTRAS_STATEMENTS } from "./schemaBotExtras.ts";
import { GAMES_STATEMENTS } from "./schemaGames.ts";
import { BROWSER_STATEMENTS } from "./schemaBrowser.ts";
import { KNOWLEDGE_STATEMENTS } from "./schemaKnowledge.ts";
import { LEARN_STATEMENTS } from "./schemaLearn.ts";
import { COACH_STATEMENTS } from "./schemaCoach.ts";
import { STUDY_STATEMENTS } from "./schemaStudy.ts";
// Bootstrap mirror of src-tauri/migrations/26_social_post_meta.sql (see schema.ts).
export const SOCIAL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS social_post_meta (
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (platform, post_id)
)`,
];

export const LATER_STATEMENTS: string[] = [...PENTEST_STATEMENTS, ...SOCIAL_STATEMENTS, ...SKILLS_STATEMENTS, ...BOT_STATEMENTS, ...CLONED_STATEMENTS, ...YOUTUBE_STATEMENTS, ...CONGRESS_STATEMENTS, ...CALENDAR_STATEMENTS, ...NOTIF_STATEMENTS, ...LAB_STATEMENTS, ...TASTE_STATEMENTS, ...ACCOUNTS_STATEMENTS, ...PRODUCTIVITY_STATEMENTS, ...MEDIA_STATEMENTS, ...FEEDS_STATEMENTS, ...PCNET_STATEMENTS, ...BOT_EXTRAS_STATEMENTS, ...GAMES_STATEMENTS, ...BROWSER_STATEMENTS, ...KNOWLEDGE_STATEMENTS, ...LEARN_STATEMENTS, ...COACH_STATEMENTS, ...STUDY_STATEMENTS];
