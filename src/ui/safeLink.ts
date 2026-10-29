// Pure link helpers. openLink() (ui/openLink.ts) routes http(s) links to the
// in-app browser panel (hub.browser) unless Settings > `links_open_in` = system.

/** Only http(s) links may reach the opener plugin; anything else -> null. */
export function safeLink(l: unknown): string | null {
  return typeof l === "string" && /^https?:\/\//i.test(l) ? l : null;
}

export const BROWSER_ID = "hub.browser";
export const BROWSER_PENDING = "browser_pending"; // localStorage queue, drained by the browser panel
export const BROWSER_OPEN = "browser-open";

/** Pure: queue `url` onto the JSON list in `raw` (max 20, deduped). */
export function queueLink(raw: string | null, url: string): string {
  let q: unknown;
  try { q = raw ? JSON.parse(raw) : []; } catch { q = []; }
  const list = Array.isArray(q) ? q.filter((x): x is string => typeof x === "string" && x !== url) : [];
  return JSON.stringify([...list, url].slice(-20));
}
