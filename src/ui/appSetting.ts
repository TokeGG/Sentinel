// Generic app_settings key/value access for module panels.
import { getDb } from "../core/db";

export async function getSetting(key: string): Promise<string | null> {
  const d = await getDb();
  const r = await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [key]);
  return r[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2", [key, value]);
}
