// Steam wishlist fetch (button press only; preview, then add_wishes), deal -> calendar, per-wish threshold.
import { fetch } from "@tauri-apps/plugin-http";
import { getDb } from "../../core/db";
import { registry, type SkillDef } from "../../core/module";
import { getSetting, setSetting } from "../../ui/appSetting";
import { listWishes } from "./extraStore";
import { appUrl, newWishes, parseAppName, parseProfileXml, parseWishlist, steamTarget, vanityUrl, wishlistUrl } from "./steam";
import { dealCalendarItem } from "./toCalendar";

const MAX_APPS = 60;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wishlist game names not yet wishes. Remembers the profile in app_settings `steam_profile`. */
async function steamWishlist(a?: Record<string, unknown>) {
  const input = String(a?.profile ?? "");
  const t = steamTarget(input);
  if (!t) throw new Error("enter a Steam profile id, profile URL or custom URL name");
  await setSetting("steam_profile", input.trim());
  let id = "id" in t ? t.id : null;
  if (!id && "vanity" in t) {
    id = parseProfileXml(await (await fetch(vanityUrl(t.vanity))).text());
    if (!id) throw new Error("Steam profile not found (is it public?)");
  }
  const res = await fetch(wishlistUrl(id!));
  if (!res.ok) throw new Error(`Steam wishlist: HTTP ${res.status} (wishlist must be public)`);
  const apps = parseWishlist(await res.json()).slice(0, MAX_APPS);
  const names: string[] = [];
  for (const app of apps) {
    try { const n = parseAppName(await (await fetch(appUrl(app))).json(), app); if (n) names.push(n); } catch { /* skip one */ }
    await sleep(350); // stay well under the store API rate limit
  }
  return { names: newWishes(names, (await listWishes()).map((w) => w.term)), total: apps.length };
}

async function addWishes(a?: Record<string, unknown>) {
  const names = Array.isArray(a?.names) ? (a!.names as unknown[]).map((n) => String(n).trim()).filter((n) => n.length >= 2).slice(0, MAX_APPS) : [];
  const d = await getDb();
  for (const n of newWishes(names, (await listWishes()).map((w) => w.term))) await d.execute("INSERT INTO deal_wishlist (term, max_price) VALUES ($1, NULL)", [n]);
  return { ok: true, added: names.length };
}

async function dealToCalendar(a?: Record<string, unknown>) {
  const add = registry.find((m) => m.id === "hub.calendar")?.skills.find((s) => s.name === "add_item");
  if (!add) throw new Error("Calendar module is not available");
  await add.run(dealCalendarItem({ title: a?.title, link: a?.link }, new Date()));
  return { ok: true };
}

async function setWishMax(a?: Record<string, unknown>) {
  const max = Number(a?.max_price);
  await (await getDb()).execute("UPDATE deal_wishlist SET max_price = $1 WHERE id = $2", [Number.isFinite(max) && max > 0 ? max : null, Number(a?.id)]);
  return { ok: true };
}

export const savedSteamProfile = () => getSetting("steam_profile").then((v) => v ?? "").catch(() => "");

export const wishSkills: SkillDef[] = [
  { name: "steam_wishlist", run: steamWishlist },
  { name: "add_wishes", run: addWishes },
  { name: "deal_to_calendar", run: dealToCalendar },
  { name: "set_wish_max", run: setWishMax },
];
