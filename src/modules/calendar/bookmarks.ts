// Pure bookmarks / read-later helpers.
export type Bookmark = { id: number; url: string; title: string; tags: string; read: number; saved_at: string };

/** Trims, requires http(s), drops the #fragment and common tracking params. Throws when not a web URL. */
export function normalizeUrl(input: string): string {
  const u = new URL(input.trim());
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) links");
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/.test(k)) u.searchParams.delete(k);
  return u.toString();
}

export const titleFromUrl = (url: string) => { try { const u = new URL(url); return u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname); } catch { return url; } };

export function filterBookmarks(list: Bookmark[], opts: { unreadOnly?: boolean; q?: string }): Bookmark[] {
  const q = (opts.q ?? "").toLowerCase().trim();
  return list.filter((b) => (!opts.unreadOnly || !b.read) && (!q || `${b.title} ${b.url} ${b.tags}`.toLowerCase().includes(q)));
}
