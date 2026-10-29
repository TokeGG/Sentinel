// Pure chat extras: per-user prefs, ignore list, word filters, highlights, emote
// picker search, stream player embeds for multiview, log capping.
import type { EmoteSet } from "./emotes.ts";
import type { Incoming } from "./types.ts";

export const userKey = (site: string, user: string) => `${site}:${user.toLowerCase()}`;
export interface UserPref { nick: string; color: string }
export interface Filters { ignore: Set<string>; words: string[]; highlights: string[] }
export const emptyFilters = (): Filters => ({ ignore: new Set(), words: [], highlights: [] });

/** From chat_filters rows (kind ignore|word|highlight). */
export function toFilters(rows: { kind: string; value: string }[]): Filters {
  const f = emptyFilters();
  for (const r of rows) {
    if (r.kind === "ignore") f.ignore.add(r.value.toLowerCase());
    else if (r.kind === "word") f.words.push(r.value.toLowerCase());
    else if (r.kind === "highlight") f.highlights.push(r.value.toLowerCase());
  }
  return f;
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, w: string) => !!w && new RegExp(`(^|[^\\p{L}\\p{N}])${esc(w)}($|[^\\p{L}\\p{N}])`, "iu").test(text);

/** "hide" (ignored user or filtered word), "highlight" (keyword), or "show". Notices always show. */
export function classify(m: Pick<Incoming, "user" | "text" | "kind">, f: Filters): "hide" | "highlight" | "show" {
  if (m.kind === "notice") return "show";
  if (f.ignore.has(m.user.toLowerCase()) || f.words.some((w) => hasWord(m.text, w))) return "hide";
  return f.highlights.some((w) => hasWord(m.text, w)) ? "highlight" : "show";
}
export const isHexColor = (s: string) => /^#[0-9a-f]{6}$/i.test(s);
export const cleanValue = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 60);

/** Emote names containing `q` (case-insensitive), prefix matches first, max `n`. */
export function pickEmotes(set: EmoteSet, q: string, n = 60): { name: string; url: string }[] {
  const s = q.trim().toLowerCase();
  const all = [...set].filter(([k]) => !s || k.toLowerCase().includes(s));
  all.sort(([a], [b]) => Number(!a.toLowerCase().startsWith(s)) - Number(!b.toLowerCase().startsWith(s)) || a.localeCompare(b));
  return all.slice(0, n).map(([name, d]) => ({ name, url: d.url }));
}
/** Adds an emote name to the draft with single spaces around it. */
export const insertEmote = (draft: string, name: string) => `${draft.replace(/\s*$/, "")}${draft.trim() ? " " : ""}${name} `;

/** Live player iframe URL for multiview (Twitch needs the embedding host as `parent`). */
export function playerEmbed(site: string, target: string, host: string): string | null {
  const ch = target.split("@")[0].toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(ch)) return null;
  if (site === "twitch") return `https://player.twitch.tv/?channel=${ch}&parent=${encodeURIComponent(host || "localhost")}&muted=true`;
  if (site === "kick") return `https://player.kick.com/${ch}?muted=true`;
  return null;
}
/** Rows over `cap` to delete (oldest first) given the current count. */
export const overCap = (count: number, cap: number) => Math.max(0, count - Math.max(0, cap));
