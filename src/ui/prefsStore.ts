// SQLite persistence for saved views. Every row read goes through mergeView so
// a corrupt or foreign row can never reach the UI.
import { getDb } from "../core/db";
import type { CustomizeDef } from "../core/customizeChecks";
import { defaultView, mergeView, type View } from "./prefs";

type Row = { view: string; json: string; active: number };

function parse(row: Row, c?: CustomizeDef, base?: Partial<View>): View {
  let raw: unknown;
  try {
    raw = JSON.parse(row.json);
  } catch {
    return defaultView(c, row.view, base);
  }
  return { ...mergeView(raw, c), name: row.view };
}

const SELECT_ROWS = "SELECT view, json, active FROM panel_prefs WHERE module_id = $1 ORDER BY view";

export async function loadViews(
  moduleId: string,
  c?: CustomizeDef,
  base?: Partial<View>
): Promise<{ views: View[]; active: string }> {
  const d = await getDb();
  let rows = await d.select<Row[]>(SELECT_ROWS, [moduleId]);
  if (rows.length === 0) {
    // OR IGNORE: a concurrent first load may have seeded already; re-read below.
    const v = defaultView(c, undefined, base);
    await d.execute(
      "INSERT OR IGNORE INTO panel_prefs (module_id, view, json, active) VALUES ($1, $2, $3, 1)",
      [moduleId, v.name, JSON.stringify(v)]
    );
    rows = await d.select<Row[]>(SELECT_ROWS, [moduleId]);
  }
  const views = rows.map((r) => parse(r, c, base));
  const active = rows.find((r) => r.active === 1)?.view ?? views[0].name;
  return { views, active };
}

export async function saveView(moduleId: string, v: View): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO panel_prefs (module_id, view, json) VALUES ($1, $2, $3)
     ON CONFLICT(module_id, view) DO UPDATE SET json = $3`,
    [moduleId, v.name, JSON.stringify(v)]
  );
}

export async function setActiveView(moduleId: string, name: string): Promise<void> {
  const d = await getDb();
  await d.execute("UPDATE panel_prefs SET active = (view = $2) WHERE module_id = $1", [moduleId, name]);
}

export async function deleteView(moduleId: string, name: string): Promise<void> {
  const d = await getDb();
  // One guarded statement: the last remaining view can never be removed.
  await d.execute(
    `DELETE FROM panel_prefs WHERE module_id = $1 AND view = $2
     AND (SELECT COUNT(*) FROM panel_prefs WHERE module_id = $1) > 1`,
    [moduleId, name]
  );
  await d.execute(
    `UPDATE panel_prefs SET active = 1 WHERE module_id = $1
     AND view = (SELECT MIN(view) FROM panel_prefs WHERE module_id = $1)
     AND NOT EXISTS (SELECT 1 FROM panel_prefs WHERE module_id = $1 AND active = 1)`,
    [moduleId]
  );
}
