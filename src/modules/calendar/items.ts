// SQLite side of the calendar's own events and tasks (table calendar_items, migration 32).
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getDb, logActivity } from "../../core/db";
import { numericId } from "../../ui/rowId";
import { serializeIcs, type IcsEvent } from "./ics";
import { toFields, type ItemFields } from "./itemInput";
import type { DbItem } from "./ownRows";
import { keptUrl } from "./dealLink";
import { nextDay } from "./recur";
import { moveTo } from "./views";

export async function listItems(): Promise<DbItem[]> {
  const d = await getDb();
  return d.select<DbItem[]>("SELECT c.*, m.url, m.origin FROM calendar_items c LEFT JOIN calendar_item_meta m ON m.item_id = c.id ORDER BY c.starts_at, c.id");
}

const cols = (f: ItemFields) => [f.kind, f.title, f.startsAt, f.endsAt, f.allDay ? 1 : 0, f.rrule, f.notes, f.parentId];

export async function addItem(args?: Record<string, unknown>) {
  const f = toFields(args);
  const d = await getDb();
  const r = await d.execute(
    "INSERT INTO calendar_items (kind, title, starts_at, ends_at, all_day, rrule, notes, parent_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    cols(f)
  );
  await setMeta(Number(r.lastInsertId), keptUrl(args), String(args?.origin ?? ""));
  await logActivity("calendar", "add_item", `added ${f.kind}`, "ok");
  return { ok: true };
}

/** Kept source link (deal/bill/coupon) + origin ("deal", "sub:<id>", "csv") for an item. */
async function setMeta(id: number, url: string | null, origin: string) {
  if (!id || (!url && !origin)) return;
  await (await getDb()).execute("INSERT INTO calendar_item_meta (item_id, url, origin) VALUES ($1,$2,$3) ON CONFLICT(item_id) DO UPDATE SET url = $2, origin = $3", [id, url, origin]);
}

export async function updateItem(args?: Record<string, unknown>) {
  const id = numericId(args?.id);
  const f = toFields(args);
  const d = await getDb();
  await d.execute(
    "UPDATE calendar_items SET kind=$1, title=$2, starts_at=$3, ends_at=$4, all_day=$5, rrule=$6, notes=$7, parent_id=$8 WHERE id=$9",
    [...cols(f), id]
  );
  if (args && ("url" in args || "link" in args)) await setMeta(id, keptUrl(args), String(args.origin ?? ""));
  return { ok: true };
}

/** Completes a task; a repeating one moves to its next date instead. Un-completes a done task. */
export async function toggleDone(args?: Record<string, unknown>) {
  const id = numericId(args?.id);
  const d = await getDb();
  const [it] = await d.select<DbItem[]>("SELECT * FROM calendar_items WHERE id = $1", [id]);
  if (!it) throw new Error("item not found");
  const next = it.done ? null : it.starts_at ? nextDay(it.starts_at, it.rrule) : null;
  if (next) await d.execute("UPDATE calendar_items SET starts_at = $1 WHERE id = $2", [next + it.starts_at!.slice(10), id]);
  else await d.execute("UPDATE calendar_items SET done = $1 WHERE id = $2", [it.done ? 0 : 1, id]);
  return { ok: true, advanced: !!next };
}

/** Drag-to-day: moves an item to `day`, keeping its time of day. */
export async function moveItem(args?: Record<string, unknown>) {
  const id = numericId(args?.id);
  const d = await getDb();
  const [it] = await d.select<DbItem[]>("SELECT * FROM calendar_items WHERE id = $1", [id]);
  if (!it) throw new Error("item not found");
  await d.execute("UPDATE calendar_items SET starts_at = $1, all_day = $2 WHERE id = $3", [moveTo(it.starts_at, String(args?.day ?? "")), it.starts_at && it.starts_at.length > 10 ? 0 : 1, id]);
  return { ok: true };
}

export async function deleteItem(args?: Record<string, unknown>) {
  const id = numericId(args?.id);
  const d = await getDb();
  await d.execute("DELETE FROM calendar_item_meta WHERE item_id IN (SELECT id FROM calendar_items WHERE parent_id = $1 OR id = $1)", [id]);
  await d.execute("DELETE FROM calendar_items WHERE parent_id = $1 OR id = $1", [id]);
  await logActivity("calendar", "delete_item", `deleted item #${id}`, "ok");
  return { ok: true };
}

/** Adds parsed ICS events, skipping ones already present (same UID, or same title + start). */
export async function importEvents(args?: Record<string, unknown>) {
  const evs = Array.isArray(args?.events) ? (args!.events as IcsEvent[]) : [];
  const d = await getDb();
  const have = await d.select<{ uid: string | null; title: string; starts_at: string | null }[]>("SELECT uid, title, starts_at FROM calendar_items WHERE kind = 'event'");
  const seen = new Set(have.flatMap((h) => [h.uid && `u:${h.uid}`, `t:${h.title}|${h.starts_at}`]).filter(Boolean) as string[]);
  let added = 0;
  for (const e of evs) {
    const f = toFields({ kind: "event", title: e.title, day: e.start.slice(0, 10), time: e.allDay ? "" : e.start.slice(11, 16), notes: e.notes });
    if ((e.uid && seen.has(`u:${e.uid}`)) || seen.has(`t:${f.title}|${f.startsAt}`)) continue;
    const r = await d.execute(
      "INSERT INTO calendar_items (kind, title, starts_at, ends_at, all_day, rrule, notes, uid) VALUES ('event',$1,$2,$3,$4,$5,$6,$7)",
      [f.title, f.startsAt, e.end, f.allDay ? 1 : 0, e.rrule, f.notes, e.uid]
    );
    if (args?.origin) await setMeta(Number(r.lastInsertId), null, String(args.origin));
    added++;
  }
  await logActivity("calendar", "import_ics", `${evs.length} event(s) in file`, `${added} added, ${evs.length - added} already there`);
  return { ok: true, added, skipped: evs.length - added };
}

/** Writes every event (not tasks) to an .ics file the user picks; null path = cancelled. */
export async function exportIcs() {
  const d = await getDb();
  const rows = await d.select<DbItem[]>("SELECT * FROM calendar_items WHERE kind = 'event' AND starts_at IS NOT NULL ORDER BY starts_at");
  const evs: IcsEvent[] = rows.map((r) => ({
    uid: `sentinel-${r.id}@sentinel.local`, title: r.title, start: r.starts_at!.slice(0, r.all_day ? 10 : 16), end: r.ends_at,
    allDay: r.all_day === 1, notes: r.notes, rrule: r.rrule,
  }));
  const path = await save({ defaultPath: "sentinel-calendar.ics", filters: [{ name: "iCalendar", extensions: ["ics"] }] });
  if (!path) return { ok: false, cancelled: true };
  await invoke("write_text_file", { path, contents: serializeIcs(evs) });
  await logActivity("calendar", "export_ics", `${evs.length} event(s)`, "written");
  return { ok: true, count: evs.length };
}
