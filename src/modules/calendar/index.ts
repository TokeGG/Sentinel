import { getDb } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { calendarSections, overdueCount } from "./panelLogic";

// Not a new data source — an aggregated view over dated rows other modules
// already have. Each module keeps owning its own data; this just unions and
// sorts what's upcoming. A module with no rows yet simply contributes none.
async function loadAgenda(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const rows: { id: string; title: string; due: string; source: string; text: string; task?: boolean }[] = [];

  const weather = await d.select<{ label: string; created_at: string }[]>(
    "SELECT label, created_at FROM weather_locations"
  );
  // Weather has no real "due date" — skipped from the agenda on purpose;
  // included here as the template for a future module that does.
  void weather;

  const deals = await d.select<{ id: number; title: string; published_at: string | null; fetched_at: string }[]>(
    "SELECT id, title, published_at, fetched_at FROM deal_offers ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT 20"
  );
  for (const row of deals) {
    rows.push({
      id: `deal-${row.id}`,
      title: `Deal: ${row.title}`,
      text: row.title,
      source: "Deals",
      due: row.published_at ?? row.fetched_at,
    });
  }

  const notes = await d.select<{ id: number; body: string; created_at: string }[]>(
    "SELECT id, body, created_at FROM notes WHERE filed_to IS NULL ORDER BY created_at DESC LIMIT 20"
  );
  for (const row of notes) {
    // An unfiled note is the one "to do" here: it can become overdue.
    rows.push({
      id: `note-${row.id}`,
      title: `Unfiled note: ${row.body.slice(0, 80)}`,
      text: row.body.slice(0, 80),
      source: "Notes",
      due: row.created_at,
      task: true,
    });
  }

  const earnings = await d.select<{ id: number; symbol: string; last_checked: string | null }[]>(
    "SELECT id, symbol, last_checked FROM watchlist WHERE last_checked IS NOT NULL ORDER BY last_checked DESC LIMIT 10"
  );
  for (const row of earnings) {
    rows.push({
      id: `watch-${row.id}`,
      title: `${row.symbol.toUpperCase()} last checked`,
      text: `${row.symbol.toUpperCase()} last checked`,
      source: "Finance",
      due: row.last_checked!,
    });
  }

  rows.sort((a, b) => (a.due < b.due ? 1 : -1)); // newest/soonest first
  // title/label keep the generic list working; source/text/due/task feed the panel.
  return rows.map((r) => ({ ...r, label: r.due }));
}

export const calendarModule: ModuleManifest = {
  id: "hub.calendar",
  name: "Calendar & Tasks",
  accent: "#8f9bff",
  ring: "daily",
  icon: "calendar",
  description:
    "Aggregates dated items already tracked by other modules — not its own data source. Grows as more modules add dated rows.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: calendarSections },
  // Overdue items (unfiled notes dated before today): local rows only, no network.
  badge: async () => overdueCount(await loadAgenda(), new Date()),
  skills: [],
  load: loadAgenda,
};

registerModule(calendarModule);
