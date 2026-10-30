// Holiday toggles/edits/countries (app_settings JSON) + Nager.Date cache per year + ICS URL subscriptions.
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { enabledSets, holidaysFor, type Edits, type Holiday } from "./holidays";
import { addItem, importEvents } from "./items";
import { parseIcs } from "./ics";
import { nagerUrl, parseNager, validCountry } from "./nager";

export interface HolidayPrefs { sets: Record<string, boolean>; edits: Edits; countries: string[] }
const KEY = "cal_holidays";

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await (await getDb()).select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [key]);
  try { return r[0] ? (JSON.parse(r[0].value) as T) : fallback; } catch { return fallback; }
}
async function putSetting(key: string, v: unknown) {
  await (await getDb()).execute("INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, JSON.stringify(v)]);
}

export const loadPrefs = async () => ({ sets: {}, edits: {}, countries: [], ...(await getSetting<Partial<HolidayPrefs>>(KEY, {})) }) as HolidayPrefs;
export const savePrefs = (p: HolidayPrefs) => putSetting(KEY, p);

/** Country holidays for a year: cached in app_settings; fetched only when `fetchMissing`. */
async function country(cc: string, year: number, fetchMissing: boolean): Promise<Holiday[]> {
  const key = `cal_nager:${cc}:${year}`;
  const cached = await getSetting<Holiday[] | null>(key, null);
  if (cached || !fetchMissing) return cached ?? [];
  const res = await fetch(nagerUrl(year, cc));
  if (!res.ok) throw new Error(`${nagerUrl(year, cc)} answered ${res.status}`);
  const hs = parseNager(await res.json(), cc);
  await putSetting(key, hs);
  return hs;
}

/** Every enabled holiday for the given years (country sets from cache only; no network). */
export async function allHolidays(years: number[]): Promise<Holiday[]> {
  const p = await loadPrefs();
  const out: Holiday[] = [];
  for (const y of years) {
    out.push(...holidaysFor(y, enabledSets(p.sets), p.edits));
    for (const cc of p.countries) out.push(...(await country(cc, y, false)));
  }
  return out;
}

/** Skill: fetch (and cache) country holidays for this and next year. */
export async function refreshHolidays() {
  const p = await loadPrefs();
  const y = new Date().getFullYear();
  let n = 0;
  for (const cc of p.countries.filter(validCountry)) for (const yr of [y, y + 1]) n += (await country(cc, yr, true)).length;
  return { ok: true, count: n };
}

export interface Sub { id: number; url: string; name: string; last_fetched: string | null; last_count: number }
export const listSubs = async () => (await getDb()).select<Sub[]>("SELECT * FROM calendar_subs ORDER BY id");

export async function addSub(a?: Record<string, unknown>) {
  const url = String(a?.url ?? "").trim().replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url)) throw new Error("subscription needs an http(s) or webcal URL");
  await (await getDb()).execute("INSERT INTO calendar_subs (url, name) VALUES ($1,$2) ON CONFLICT(url) DO NOTHING", [url, String(a?.name ?? "").trim()]);
  return refreshSubs();
}

export async function removeSub(a?: Record<string, unknown>) {
  await (await getDb()).execute("DELETE FROM calendar_subs WHERE id = $1", [Number(a?.id)]);
  return { ok: true };
}

/** Skill (button or opt-in schedule): re-reads each subscribed .ics; new events only (dedupe by UID). */
export async function refreshSubs() {
  const d = await getDb();
  let added = 0;
  for (const s of await listSubs()) {
    const res = await fetch(s.url);
    if (!res.ok) { await logActivity("calendar", "refresh_subs", s.url, `HTTP ${res.status}`); continue; }
    const { events } = parseIcs(await res.text());
    const out = await importEvents({ events, origin: `sub:${s.id}` });
    added += out.added;
    await d.execute("UPDATE calendar_subs SET last_fetched = datetime('now'), last_count = $1 WHERE id = $2", [events.length, s.id]);
  }
  return { ok: true, added };
}

/** Skill: CSV rows (already previewed, see csvImport.ts) -> events/tasks. */
export async function importCsv(a?: Record<string, unknown>) {
  const rows = Array.isArray(a?.rows) ? (a!.rows as { title: string; day: string; time: string; notes: string }[]) : [];
  for (const r of rows) await addItem({ kind: "event", ...r, origin: "csv" });
  return { ok: true, added: rows.length };
}
