// All SQL for panel_layout and app_settings lives here (Task 7/8 rulings:
// Rust only shapes/clamps; the frontend owns persistence via db.ts).
import { getDb } from "../core/db";
import type { Rect } from "./layout";

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
