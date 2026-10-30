// Social site tabs persisted as JSON in app_settings `social_tabs` (no migration).
import { getDb } from "../../core/db";
import { parseTabs, type EmbedSite } from "./embedSites";

const KEY = "social_tabs";

export async function loadTabs(): Promise<EmbedSite[]> {
  const rows = await (await getDb()).select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [KEY]);
  return parseTabs(rows.length ? rows[0].value : null);
}
export async function saveTabs(tabs: EmbedSite[]): Promise<void> {
  await (await getDb()).execute(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [KEY, JSON.stringify(tabs)],
  );
}
