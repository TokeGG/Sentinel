// app_settings rows owned by the Settings panel. Reads fall back to defaults
// only when no row exists; DB errors propagate to the caller's error line.
import { getDb } from "../core/db";
import { sanitizeAppearance, type Appearance } from "./settingsLogic";

export type { Appearance };
const APPEARANCE = "appearance_defaults";
const RESTORE = "restore_panels";

async function read(key: string): Promise<string | null> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [key]);
  return rows.length === 0 ? null : rows[0].value;
}
async function write(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [key, value]
  );
}

export async function getAppearance(): Promise<Appearance> {
  const v = await read(APPEARANCE);
  let raw: unknown;
  try {
    raw = v === null ? null : JSON.parse(v);
  } catch {
    raw = null;
  }
  return sanitizeAppearance(raw);
}
export const setAppearance = (a: Appearance): Promise<void> => write(APPEARANCE, JSON.stringify(sanitizeAppearance(a)));

// Default ON when no row exists.
export async function getRestorePanels(): Promise<boolean> {
  return (await read(RESTORE)) !== "0";
}
export const setRestorePanels = (on: boolean): Promise<void> => write(RESTORE, on ? "1" : "0");
