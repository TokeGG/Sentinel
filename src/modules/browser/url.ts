// Pure address-bar logic: typed text -> URL to load (or a search), search engines.
export type Engine = "duckduckgo" | "google" | "bing" | "brave" | "startpage";
export const ENGINES: Record<Engine, { name: string; q: string }> = {
  duckduckgo: { name: "DuckDuckGo", q: "https://duckduckgo.com/?q=" },
  google: { name: "Google", q: "https://www.google.com/search?q=" },
  bing: { name: "Bing", q: "https://www.bing.com/search?q=" },
  brave: { name: "Brave Search", q: "https://search.brave.com/search?q=" },
  startpage: { name: "Startpage", q: "https://www.startpage.com/do/search?q=" },
};
export const isEngine = (v: unknown): v is Engine => typeof v === "string" && v in ENGINES;
export const searchUrl = (q: string, e: Engine = "duckduckgo") => ENGINES[isEngine(e) ? e : "duckduckgo"].q + encodeURIComponent(q.trim());

const HOSTLIKE = /^(localhost|\[[0-9a-f:]+\]|(\d{1,3}\.){3}\d{1,3}|([a-z0-9-]+\.)+[a-z][a-z0-9-]{1,62})(:\d{1,5})?([/?#].*)?$/i;

/** Address-bar input -> http(s) URL. Explicit http(s) URLs pass; "example.com/x" gets https://;
 *  anything else (spaces, no dot, other schemes) becomes a search. Never returns a non-http(s) URL. */
export function normalizeInput(input: string, engine: Engine = "duckduckgo"): string {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) {
    try { return new URL(t).href; } catch { return searchUrl(t, engine); }
  }
  if (!/\s/.test(t) && HOSTLIKE.test(t)) {
    const scheme = /^(localhost|(\d{1,3}\.){3}\d{1,3})/i.test(t) ? "http://" : "https://";
    try { return new URL(scheme + t).href; } catch { /* fall through */ }
  }
  return searchUrl(t, engine);
}

/** Host for display ("www." dropped); "" for junk. */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
/** Only http(s) URLs are ever loaded or stored. */
export const isWebUrl = (u: unknown): u is string => {
  if (typeof u !== "string") return false;
  try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; }
};
