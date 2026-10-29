// Show tracker storage (media_shows) + TVmaze lookups + hand-off to the Calendar add_item skill.
import { fetch } from "@tauri-apps/plugin-http";
import { getDb } from "../../core/db";
import { registry } from "../../core/module";
import { findSkill } from "../../ui/moduleRun";
import { numericId } from "../../ui/rowId";
import { parseNextEpisode, parseShowSearch, tvmazeSearchUrl, tvmazeShowUrl } from "./parsers";

export interface ShowRow { id: number; tvmaze_id: number | null; name: string; next_day: string | null; next_label: string }
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const listShows = async (): Promise<ShowRow[]> =>
  (await getDb()).select<ShowRow[]>("SELECT * FROM media_shows ORDER BY next_day IS NULL, next_day, name");

async function nextOf(tvmazeId: number) {
  return parseNextEpisode(await (await fetch(tvmazeShowUrl(tvmazeId))).json());
}

/** Adds the first TVmaze match for `name`; with manual=true stores the name as typed (no lookup). */
export async function addShow(a?: Record<string, unknown>) {
  const q = String(a?.name ?? "").trim();
  if (!q) throw new Error("show name is empty");
  const d = await getDb();
  if (a?.manual) {
    await d.execute("INSERT INTO media_shows (name) VALUES ($1)", [q]);
    return { ok: true };
  }
  const hit = parseShowSearch(await (await fetch(tvmazeSearchUrl(q))).json())[0];
  if (!hit) throw new Error(`TVmaze found no show for "${q}"`);
  const n = await nextOf(hit.id);
  await d.execute("INSERT INTO media_shows (tvmaze_id, name, next_day, next_label) VALUES ($1, $2, $3, $4)", [hit.id, hit.name, n.day, n.label]);
  return { ok: true };
}

export async function refreshShows() {
  const d = await getDb();
  for (const s of await listShows()) {
    if (!s.tvmaze_id) continue;
    try {
      const n = await nextOf(s.tvmaze_id);
      await d.execute("UPDATE media_shows SET next_day = $1, next_label = $2 WHERE id = $3", [n.day, n.label, s.id]);
    } catch { /* keep the old date */ }
  }
  return { ok: true };
}

export async function setNext(a?: Record<string, unknown>) {
  const day = String(a?.day ?? "").trim();
  if (day && !DAY.test(day)) throw new Error("date must be YYYY-MM-DD");
  await (await getDb()).execute("UPDATE media_shows SET next_day = $1 WHERE id = $2", [day || null, numericId(a?.id)]);
  return { ok: true };
}

export async function removeShow(a?: Record<string, unknown>) {
  await (await getDb()).execute("DELETE FROM media_shows WHERE id = $1", [numericId(a?.id)]);
  return { ok: true };
}

export async function showToCalendar(a?: Record<string, unknown>) {
  const s = (await listShows()).find((x) => x.id === numericId(a?.id));
  if (!s?.next_day) throw new Error("this show has no next episode date");
  const cal = registry.find((m) => m.id === "hub.calendar");
  if (!cal) throw new Error("Calendar module is not available");
  await findSkill(cal, "add_item").run({ kind: "event", title: `${s.name}${s.next_label ? ` · ${s.next_label}` : ""}`, day: s.next_day });
  return { ok: true };
}
