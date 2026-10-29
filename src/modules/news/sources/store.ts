// SQLite side of source catalogs: state JSON in app_settings, and "Check sources" (fetch each feed once).
import { fetch } from "@tauri-apps/plugin-http";
import { getDb } from "../../../core/db";
import { checkVerdict, parseState, pool, type StateMap } from "./logic";

const key = (kind: string) => `src_state:${kind}`;

export async function loadState(kind: string): Promise<StateMap> {
  const r = await (await getDb()).select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [key(kind)]);
  return parseState(r[0]?.value);
}

export async function saveState(kind: string, s: StateMap): Promise<void> {
  await (await getDb()).execute(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2", [key(kind), JSON.stringify(s)]);
}

export async function patchState(kind: string, url: string, p: StateMap[string]): Promise<void> {
  const s = await loadState(kind);
  s[url] = { ...s[url], ...p };
  await saveState(kind, s);
}

export const timeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`timed out after ${ms / 1000}s`)), ms))]);

/** Fetches every url (6 at a time, 20 s each) and records working/broken. */
export async function checkSources(kind: string, urls: string[]): Promise<{ working: number; broken: number }> {
  const s = await loadState(kind);
  let working = 0;
  await pool(urls, 6, async (url) => {
    let v: { status: "working" | "broken" | "unverified"; err?: string };
    try {
      const res = await timeout(fetch(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } }), 20000);
      v = checkVerdict(res.status, await res.text());
    } catch (e) {
      v = { status: "broken", err: e instanceof Error ? e.message : String(e) };
    }
    if (v.status === "working") working++;
    s[url] = { ...s[url], status: v.status, err: v.err ?? "", at: new Date().toISOString() };
  });
  await saveState(kind, s);
  return { working, broken: urls.length - working };
}
