// Network side of data sources: one request per call, only from a user action (Test, or an Ask with sources on).
import { fetch } from "@tauri-apps/plugin-http";
import { getSetting, setSetting } from "../../ui/appSetting";
import type { Category } from "../categories";
import { enabledKey, sourcesFor } from "./registry";
import type { DataSource, DsRow } from "./types";

export async function querySource(s: DataSource, q: string, signal?: AbortSignal): Promise<DsRow[]> {
  const r = s.request(q);
  const res = await fetch(r.url, { method: r.method ?? "GET", body: r.body, signal, headers: { accept: "application/json, text/csv;q=0.9", ...(r.body ? { "content-type": "application/json" } : {}), "user-agent": "Sentinel desktop (local app)" } });
  if (!res.ok) throw new Error(`${s.name}: HTTP ${res.status}`);
  return s.parse(await res.text(), q);
}

export const isEnabled = async (id: string) => (await getSetting(enabledKey(id)).catch(() => null)) === "1";
export const setEnabled = (id: string, on: boolean) => setSetting(enabledKey(id), on ? "1" : "0");

/** Enabled sources of a category, each queried once; failures become a row-less note, never a throw. */
export async function queryCategory(c: Category, q: string, signal?: AbortSignal): Promise<{ source: string; rows: DsRow[]; error?: string }[]> {
  const out = [];
  for (const s of sourcesFor(c)) {
    if (!(await isEnabled(s.id))) continue;
    try { out.push({ source: s.name, rows: (await querySource(s, q, signal)).slice(0, 5) }); }
    catch (e) { out.push({ source: s.name, rows: [], error: String(e instanceof Error ? e.message : e) }); }
  }
  return out;
}
