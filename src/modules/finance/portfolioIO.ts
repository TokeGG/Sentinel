// Portfolio CSV export / import (the panel shows parseCsv's preview; import_lots writes only those rows).
import { getDb, logActivity } from "../../core/db";
import type { SkillDef } from "../../core/module";
import { parseCsv, toCsv, type CsvLot } from "./csv";

export async function exportCsv(): Promise<string> {
  const rows = await (await getDb()).select<CsvLot[]>("SELECT w.symbol, w.kind, l.qty, l.cost, l.bought_on FROM fin_lots l JOIN watchlist w ON w.id = l.watch_id ORDER BY w.symbol, l.bought_on");
  return toCsv(rows);
}

async function importLots(a?: Record<string, unknown>) {
  // Re-validate through the same parser: the skill never trusts the preview object blindly.
  const { rows } = parseCsv(String(a?.csv ?? ""));
  const d = await getDb();
  for (const r of rows) {
    await d.execute("INSERT OR IGNORE INTO watchlist (symbol, kind) VALUES ($1,$2)", [r.symbol, r.kind]);
    const [w] = await d.select<{ id: number }[]>("SELECT id FROM watchlist WHERE symbol = $1 AND kind = $2", [r.symbol, r.kind]);
    if (w) await d.execute("INSERT INTO fin_lots (watch_id, qty, cost, bought_on) VALUES ($1,$2,$3,$4)", [w.id, r.qty, r.cost, r.bought_on]);
  }
  await logActivity("finance", "import_lots", `imported ${rows.length} lot(s)`, "ok");
  return { ok: true, imported: rows.length };
}

export const ioSkills: SkillDef[] = [{ name: "import_lots", run: importLots }];
