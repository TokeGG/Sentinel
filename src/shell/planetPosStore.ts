// app_settings `planet_pos`: per-module ring + phase override from dragging planets.
import { emit, listen } from "@tauri-apps/api/event";
import { getDb } from "../core/db";
import { parsePlanetPos, type PlanetPos } from "./planetDrag";

const KEY = "planet_pos";
const subs = new Set<() => void>();
const EVENT = "planet-pos-changed"; // Settings (another webview) -> main window
export function subscribePlanetPos(f: () => void): () => void {
  subs.add(f);
  const un = listen(EVENT, f).catch(() => null);
  return () => { subs.delete(f); un.then((u) => u?.()); };
}

export async function getPlanetPos(): Promise<PlanetPos> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [KEY]);
  return parsePlanetPos(rows[0]?.value ?? null);
}
export async function setPlanetPos(p: PlanetPos): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2", [KEY, JSON.stringify(p)]);
  subs.forEach((f) => f());
}
export const resetPlanetPos = async () => { await setPlanetPos({}); await emit(EVENT, {}); };
