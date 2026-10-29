// Encrypted export/import of settings, layouts, brains, notes (every exportable
// SQLite table; secrets live in the OS keychain and are never read here).
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { getDb } from "../../core/db";
import { open as unseal, parseEnvelope, seal } from "../../core/crypto/envelope";
import { exportable, importPlan, insertSql, makeBundle, parseBundle, type Bundle, type ImportStep } from "../../core/crypto/exportLogic";

async function tables(): Promise<string[]> {
  const d = await getDb();
  const r = await d.select<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table'");
  return exportable(r.map((x) => x.name));
}

export async function exportAll(pass: string): Promise<string | null> {
  const path = await saveDialog({ defaultPath: "sentinel-export.sentinel", filters: [{ name: "Sentinel export", extensions: ["sentinel"] }] });
  if (!path) return null;
  const d = await getDb();
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const t of await tables()) data[t] = await d.select<Record<string, unknown>[]>(`SELECT * FROM ${t}`);
  const env = await seal(JSON.stringify(makeBundle(data, new Date())), pass);
  await invoke("write_text_file", { path, contents: JSON.stringify(env) });
  return path;
}

/** Step 1 (preview): pick + decrypt + plan. Nothing is written. */
export async function previewImport(pass: string): Promise<{ bundle: Bundle; plan: ImportStep[] } | null> {
  const path = await openDialog({ multiple: false, filters: [{ name: "Sentinel export", extensions: ["sentinel"] }] });
  if (!path || Array.isArray(path)) return null;
  const text = await invoke<string>("read_text_file", { path });
  const bundle = parseBundle(await unseal(parseEnvelope(text), pass));
  const d = await getDb();
  const local: Record<string, string[]> = {};
  for (const t of await tables()) {
    const cols = await d.select<{ name: string }[]>(`SELECT name FROM pragma_table_info('${t}')`);
    local[t] = cols.map((c) => c.name);
  }
  return { bundle, plan: importPlan(bundle, local) };
}

/** Step 2 (apply): insert-or-replace exactly the previewed tables/columns. */
export async function applyImport(bundle: Bundle, plan: ImportStep[]): Promise<number> {
  const d = await getDb();
  let n = 0;
  for (const step of plan) {
    const sql = insertSql(step);
    for (const row of bundle.tables[step.table]) {
      await d.execute(sql, step.columns.map((c) => row[c] ?? null));
      n++;
    }
  }
  return n;
}
