// All SQL for panel_layout and app_settings lives here (Task 7/8 rulings:
// Rust only shapes/clamps; the frontend owns persistence via db.ts).
import { getDb } from "../core/db";
import type { Rect } from "./layout";
import { clampSpeed } from "./orbit";

export type LayoutRow = {
  module_id: string; x: number; y: number; w: number; h: number; z: number; state: string;
};

export async function loadLayout(): Promise<LayoutRow[]> {
  const d = await getDb();
  return d.select<LayoutRow[]>("SELECT module_id, x, y, w, h, z, state FROM panel_layout ORDER BY z");
}

export async function saveLayout(id: string, rect: Rect, z: number, state = "open"): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO panel_layout (module_id, x, y, w, h, z, state) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(module_id) DO UPDATE SET x = $2, y = $3, w = $4, h = $5, z = $6, state = $7`,
    [id, rect.x, rect.y, rect.w, rect.h, z, state]
  );
}

export async function deleteLayout(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM panel_layout WHERE module_id = $1", [id]);
}

// Default ON when no row exists (user chose "Auto game mode" in the interview).
export async function getGameModeAuto(): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = 'game_mode_auto'"
  );
  return rows.length === 0 ? true : rows[0].value === "1";
}

export async function setGameModeAuto(enabled: boolean): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO app_settings (key, value) VALUES ('game_mode_auto', $1)
     ON CONFLICT(key) DO UPDATE SET value = $1`,
    [enabled ? "1" : "0"]
  );
}

// Default ON when no row exists.
export async function getStarMotion(): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = 'star_motion'"
  );
  return rows.length === 0 ? true : rows[0].value === "1";
}

export async function setStarMotion(enabled: boolean): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO app_settings (key, value) VALUES ('star_motion', $1)
     ON CONFLICT(key) DO UPDATE SET value = $1`,
    [enabled ? "1" : "0"]
  );
}

// Orbit settings (solar-system map). Default when no row: motion ON, speed 1;
// a stored speed is untrusted and always clamped to 0.25..2.
async function readSetting(key: string): Promise<string | null> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [key]);
  return rows.length === 0 ? null : rows[0].value;
}
async function writeSetting(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [key, value]
  );
}
export const getOrbitMotion = async (): Promise<boolean> => (await readSetting("orbit_motion")) !== "0";
export const setOrbitMotion = (on: boolean) => writeSetting("orbit_motion", on ? "1" : "0");
export async function getOrbitSpeed(): Promise<number> {
  const v = await readSetting("orbit_speed");
  return v === null ? 1 : clampSpeed(Number(v));
}
// Planet notification moons/bubble: default ON (anything but an explicit "0").
// Default on: Windows "Animation effects: off" makes WebView2 report reduced motion,
// which silently froze the map; the user opts back in to honouring it.
export const getIgnoreReduced = async (): Promise<boolean> => (await readSetting("ignore_reduced_motion")) !== "0";
export const setIgnoreReduced = (on: boolean) => writeSetting("ignore_reduced_motion", on ? "1" : "0");
export const getNotifMoons = async (): Promise<boolean> => (await readSetting("notif_moons")) !== "0";
export const setNotifMoons = (on: boolean) => writeSetting("notif_moons", on ? "1" : "0");
export const setOrbitSpeed = (v: number) => writeSetting("orbit_speed", String(clampSpeed(v)));
