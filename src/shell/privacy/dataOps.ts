// Tauri side of the data map: live tables/keys, row counts for the preview, wipe/reset, JSON export.
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getDb, logActivity } from "../../core/db";
import { keysOf, tablesOf, wipePlan, resetPlan, type ModuleData, type WipeStep } from "./dataMap";

export interface ModuleInventory { tables: { name: string; rows: number }[]; keys: string[] }

export async function allTables(): Promise<string[]> {
  const d = await getDb();
  return (await d.select<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).map((r) => r.name);
}

export async function inventory(m: ModuleData, all: string[]): Promise<ModuleInventory> {
  const d = await getDb();
  const keys = keysOf(m, (await d.select<{ key: string }[]>("SELECT key FROM app_settings")).map((r) => r.key));
  const tables = [];
  for (const t of tablesOf(m, all)) {
    const r = await d.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM ${t}`);
    tables.push({ name: t, rows: r[0]?.n ?? 0 });
  }
  return { tables, keys };
}

export const wipeSteps = (m: ModuleData, inv: ModuleInventory) => wipePlan(m, inv.tables.map((t) => t.name), inv.keys);
export const resetSteps = (m: ModuleData, inv: ModuleInventory) => resetPlan(m, inv.keys);

/** Runs exactly the previewed steps. */
export async function applySteps(m: ModuleData, steps: WipeStep[], what: string): Promise<void> {
  const d = await getDb();
  for (const s of steps) await d.execute(s.sql, s.args);
  await logActivity("hub.settings", what, m.id, `${steps.length} step(s)`);
}

/** Per-module JSON export to a file the user picks. Returns false if cancelled. */
export async function exportModule(m: ModuleData, inv: ModuleInventory): Promise<boolean> {
  const path = await save({ defaultPath: `sentinel-${m.id.replace(/^hub\./, "")}.json`, filters: [{ name: "JSON", extensions: ["json"] }] });
  if (!path) return false;
  const d = await getDb();
  const out: Record<string, unknown> = { module: m.id, exported: new Date().toISOString(), tables: {}, settings: {} };
  for (const t of inv.tables) (out.tables as Record<string, unknown>)[t.name] = await d.select(`SELECT * FROM ${t.name}`);
  for (const k of inv.keys) {
    const r = await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [k]);
    (out.settings as Record<string, unknown>)[k] = r[0]?.value ?? null;
  }
  await invoke("write_text_file", { path, contents: JSON.stringify(out, null, 2) });
  return true;
}

export const dataPaths = () => invoke<{ label: string; path: string }[]>("app_data_paths");
