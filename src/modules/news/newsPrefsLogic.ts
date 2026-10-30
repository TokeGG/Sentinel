// Pure News preferences: source block list, keyword alerts, per-source refresh intervals
// (used only by the opt-in auto-refresh) and the sanitized reader-mode document.
import { esc, sanitizeHtml } from "../email/sanitize.ts";

type Row = Record<string, unknown>;
export const BLOCK_KEY = "news_blocked";
export const ALERT_KEY = "news_alerts";
export const ALERT_SEEN_KEY = "news_alert_seen"; // highest item id the user has seen alerts up to
export const INTERVAL_KEY = "news_src_interval"; // JSON { [sourceUrl]: minutes }
export const LAST_KEY = "news_src_last"; // JSON { [sourceUrl]: ms of last auto fetch }

export function hostOf(url: unknown): string {
  try { return new URL(String(url)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

/** A blocked entry matches a host or any of its subdomains (feeds.bbc.co.uk for bbc.co.uk). */
const hostBlocked = (h: string, list: string[]) => !!h && list.some((b) => h === b || h.endsWith(`.${b}`));
export function withoutBlocked<T extends Row>(rows: T[], blocked: string[]): T[] {
  const list = blocked.map((b) => hostOf(b.includes("://") ? b : `https://${b}`)).filter(Boolean);
  return list.length ? rows.filter((r) => !hostBlocked(hostOf(r.link), list) && !hostBlocked(hostOf(r.source_url), list)) : rows;
}

/** Items whose title contains an alert word (case-insensitive), newer than `seenId`. */
export function alertHits<T extends Row>(rows: T[], words: string[], seenId = 0): T[] {
  if (!words.length) return [];
  return rows.filter((r) => Number(r.id) > seenId && words.some((w) => String(r.title ?? "").toLowerCase().includes(w)));
}

/** Parses a { key: number } JSON object (bad data dropped). */
export function readNumMap(json: string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    const j: unknown = JSON.parse(json ?? "{}");
    if (j && typeof j === "object" && !Array.isArray(j))
      for (const [k, v] of Object.entries(j)) if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  } catch { /* empty */ }
  return out;
}

/** Sources an auto-refresh run should fetch: no interval (or 0) = every run; else only once `minutes` passed. */
export function dueSources<T extends { url: string }>(sources: T[], intervals: Record<string, number>, last: Record<string, number>, now: number): T[] {
  return sources.filter((s) => !intervals[s.url] || !last[s.url] || now - last[s.url] >= intervals[s.url] * 60000);
}

/** Reader mode: the page's <article>/<main>/<body>, sanitized (allow-list, no scripts, no remote images). */
export function readerDoc(html: string, title: string, fontPx: number, widthCh: number): string {
  const pick = (t: string) => html.match(new RegExp(`<${t}[\\s>][\\s\\S]*?</${t}>`, "i"))?.[0];
  const body = sanitizeHtml(pick("article") ?? pick("main") ?? pick("body") ?? html).html;
  return `<!doctype html><meta charset="utf-8"><style>body{font:${fontPx}px/1.6 system-ui,sans-serif;max-width:${widthCh}ch;margin:16px auto;padding:0 16px;color:#ddd;background:#16181d}img{max-width:100%}a{color:#7bc6ff}</style><h1>${esc(title)}</h1>${body}`;
}
