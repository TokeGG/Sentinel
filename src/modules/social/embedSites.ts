// Pure config + reducer for the Social panel's tabs. Feed and Following & Likes are fixed;
// site tabs (embedded real sites, Rust `embed_show`, own persistent profile each) are
// user-editable and stored as JSON in app_settings `social_tabs` (tabsStore.ts).
import { SITE_PRESETS, presetOf } from "./sitePresets.ts";

export const EMBED_TAB_H = 32; // keep in sync with EMBED_TAB_H in src-tauri/src/panels/geometry.rs (test)
export const FEED_TAB = "feed";
export const FOLLOWS_TAB = "follows";
const FIXED = [{ id: FEED_TAB, label: "Feed" }, { id: FOLLOWS_TAB, label: "Following & Likes" }];
const MAX_TABS = 40;

export type EmbedSite = { id: string; label: string; url: string; profile: string; hosts: string[] };

/** Rust `is_valid_site`: 1..24 of [a-z0-9-], no edge '-'; plus not reserved / browser `tab<n>`. */
export const isValidSlug = (s: string): boolean =>
  /^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?$/.test(s) && !FIXED.some((t) => t.id === s) && !/^tab\d+$/.test(s);

const HOST = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/;
export const isValidHost = (h: string): boolean => h.length <= 253 && HOST.test(h);

/** https URL with a real host, default port, no credentials -> the URL; else null. */
export function parseSiteUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && !u.port && !u.username && !u.password && isValidHost(u.hostname) ? u : null;
  } catch { return null; }
}

/** Custom site allow-list: the URL's host (minus www.) and its subdomains. */
export function hostsFor(url: URL): string[] {
  const base = url.hostname.replace(/^www\./, "");
  return [base, `*.${base}`];
}
const covers = (hosts: string[], host: string) => hosts.some((h) => h === host || (h.startsWith("*.") && host.endsWith(h.slice(1))));

export function slugify(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20).replace(/-+$/, "") || "site";
  const ok = (s: string) => isValidSlug(s) && !taken.includes(s);
  if (ok(base)) return base;
  for (let i = 2; ; i++) if (ok(`${base}-${i}`)) return `${base}-${i}`;
}

export function defaultTabs(): EmbedSite[] {
  return ["x", "facebook", "instagram"].map((k) => { const p = presetOf(k)!; return { id: k, label: p.label, url: p.url, profile: k, hosts: p.hosts }; });
}

export type TabAction =
  | { type: "add"; name: string; url: string; preset?: string }
  | { type: "remove"; id: string }
  | { type: "rename"; id: string; label: string }
  | { type: "move"; id: string; to: number };

/** Pure reducer; an invalid action returns the same array (callers compare by identity). */
export function tabsReducer(tabs: EmbedSite[], a: TabAction): EmbedSite[] {
  if (a.type === "add") {
    const u = parseSiteUrl(a.url);
    const label = a.name.trim().slice(0, 40);
    if (!u || !label || tabs.length >= MAX_TABS) return tabs;
    const p = a.preset ? presetOf(a.preset) : undefined;
    const hosts = p ? (covers(p.hosts, u.hostname) ? p.hosts : [...p.hosts, ...hostsFor(u)]) : hostsFor(u);
    const id = slugify(label, tabs.map((t) => t.id));
    return [...tabs, { id, label, url: u.href, profile: `social-${id}`, hosts }];
  }
  const i = tabs.findIndex((t) => t.id === a.id);
  if (i < 0) return tabs;
  if (a.type === "remove") return tabs.filter((t) => t.id !== a.id);
  if (a.type === "rename") {
    const label = a.label.trim().slice(0, 40);
    return label && label !== tabs[i].label ? tabs.map((t, j) => (j === i ? { ...t, label } : t)) : tabs;
  }
  const to = Math.max(0, Math.min(tabs.length - 1, Math.trunc(a.to)));
  if (to === i || Number.isNaN(to)) return tabs;
  const next = tabs.filter((_, j) => j !== i);
  next.splice(to, 0, tabs[i]);
  return next;
}

/** Stored JSON -> validated tabs (defaults when absent/unparseable; bad entries dropped). */
export function parseTabs(raw: string | null): EmbedSite[] {
  if (raw == null) return defaultTabs();
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return defaultTabs(); }
  if (!Array.isArray(v)) return defaultTabs();
  const out: EmbedSite[] = [];
  for (const t of v.slice(0, MAX_TABS)) {
    const ok = t && typeof t.id === "string" && isValidSlug(t.id) && !out.some((o) => o.id === t.id) &&
      typeof t.label === "string" && t.label.trim() && typeof t.url === "string" && parseSiteUrl(t.url) &&
      typeof t.profile === "string" && /^[a-z0-9][a-z0-9-]{0,31}$/.test(t.profile) &&
      Array.isArray(t.hosts) && t.hosts.length && t.hosts.every((h: unknown) => typeof h === "string" && isValidHost(h));
    if (ok) out.push({ id: t.id, label: t.label.trim().slice(0, 40), url: t.url, profile: t.profile, hosts: t.hosts });
  }
  return out;
}

export const allTabs = (sites: EmbedSite[]) => [...FIXED, ...sites.map(({ id, label }) => ({ id, label }))];
/** A stored/unknown value -> a valid tab id (Feed when unrecognised). */
export const parseTab = (raw: unknown, sites: EmbedSite[] = defaultTabs()): string =>
  allTabs(sites).some((t) => t.id === raw) ? (raw as string) : FEED_TAB;
export const siteOf = (tab: string, sites: EmbedSite[] = defaultTabs()): EmbedSite | undefined => sites.find((s) => s.id === tab);
export { SITE_PRESETS };
