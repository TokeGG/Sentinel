// Thin SQLite layer for the taste model (all local). Events are a capped ledger;
// the profile is updated incrementally and stored as JSON. `taste_off:<module>`
// in app_settings turns learning off for one module.
import { getDb } from "../db";
import { applySignal, emptyProfile, forgetFeature, type Profile, type Signal } from "./model.ts";
import type { Marks } from "./order.ts";

export const EVENT_CAP = 500;
const offKey = (m: string) => `taste_off:${m}`;
const ONCE: Signal[] = ["like", "dislike", "hide", "dismiss"]; // repeating these adds nothing

export async function loadProfile(moduleId: string): Promise<Profile> {
  const d = await getDb();
  const r = await d.select<{ json: string }[]>("SELECT json FROM taste_profile WHERE module_id = $1", [moduleId]);
  try {
    const p = r[0] ? JSON.parse(r[0].json) : null;
    return p && typeof p.f === "object" ? { f: p.f, events: Number(p.events) || 0 } : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

async function saveProfile(moduleId: string, p: Profile): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT INTO taste_profile (module_id, json) VALUES ($1, $2) ON CONFLICT(module_id) DO UPDATE SET json = $2", [moduleId, JSON.stringify(p)]);
}

export async function loadMarks(moduleId: string): Promise<Marks> {
  const d = await getDb();
  const rows = await d.select<{ item_key: string; signal: Signal }[]>(
    "SELECT item_key, signal FROM taste_events WHERE module_id = $1 AND signal IN ('like','dislike','hide','dismiss') ORDER BY id", [moduleId]);
  return Object.fromEntries(rows.map((r) => [r.item_key, r.signal]));
}

export async function isOff(moduleId: string): Promise<boolean> {
  const d = await getDb();
  return (await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [offKey(moduleId)]))[0]?.value === "1";
}

export async function setOff(moduleId: string, off: boolean): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2", [offKey(moduleId), off ? "1" : "0"]);
}

/** Records one signal and returns the new profile (null = learning is off or the signal repeats). */
export async function recordSignal(moduleId: string, itemKey: string, features: string[], signal: Signal): Promise<Profile | null> {
  if (await isOff(moduleId)) return null;
  const d = await getDb();
  if (ONCE.includes(signal)) {
    const same = await d.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM taste_events WHERE module_id = $1 AND item_key = $2 AND signal = $3", [moduleId, itemKey, signal]);
    if (same[0]?.n) return null;
  }
  await d.execute("INSERT INTO taste_events (module_id, item_key, feature, signal, at) VALUES ($1, $2, $3, $4, $5)", [moduleId, itemKey, JSON.stringify(features), signal, Date.now()]);
  await d.execute("DELETE FROM taste_events WHERE module_id = $1 AND id NOT IN (SELECT id FROM taste_events WHERE module_id = $1 ORDER BY id DESC LIMIT $2)", [moduleId, EVENT_CAP]);
  const next = applySignal(await loadProfile(moduleId), features, signal);
  await saveProfile(moduleId, next);
  return next;
}

export async function forget(moduleId: string, feature: string): Promise<Profile> {
  const next = forgetFeature(await loadProfile(moduleId), feature);
  await saveProfile(moduleId, next);
  return next;
}

export async function resetTaste(moduleId: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM taste_events WHERE module_id = $1", [moduleId]);
  await d.execute("DELETE FROM taste_profile WHERE module_id = $1", [moduleId]);
}
