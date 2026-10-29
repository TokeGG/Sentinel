import { ago, utcDate } from "../../ui/kit/format.ts";

type Row = Record<string, unknown>;

export const financeSections = [
  { id: "tabs", label: "Watchlist / Congress tabs" },
  { id: "watchlist", label: "Watchlist" },
  { id: "congress", label: "Congress trades" },
  { id: "add", label: "Add symbol" },
  { id: "actions", label: "Refresh & sync" },
  { id: "tools", label: "Portfolio, alerts, budgets, bills, vault" },
];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Percent change prev -> cur; null when prev is 0/missing or either is not finite. */
export function changePct(prev: unknown, cur: unknown): number | null {
  const p = num(prev);
  const c = num(cur);
  if (p === null || c === null || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

/** "+1.23%" / "-0.50%" / "0.00%"; "—" when unknown. */
export function pctText(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "—";
  const t = Math.abs(p).toFixed(2);
  return p > 0 && t !== "0.00" ? `+${t}%` : p < 0 && t !== "0.00" ? `-${t}%` : "0.00%";
}

/** "$1,234.50"; prices under $1 keep ~4 significant digits (crypto), min 2 decimals; "—" if missing. */
export function fmtPrice(n: unknown): string {
  const v = num(n);
  if (v === null) return "—";
  if (v >= 1 || v <= 0) return "$" + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = Math.min(8, Math.max(4, 3 - Math.floor(Math.log10(v))));
  return "$" + v.toFixed(decimals).replace(/(\.\d\d\d*?)0+$/, "$1");
}

const compact = (n: number) => (n >= 1e6 ? `$${Math.round(n / 1e5) / 10}M` : `$${Math.round(n / 1e3)}k`);

/** "$1,001 - $15,000" -> "$1k–$15k"; anything else is shown as written; blank -> "—". */
export function tradeSizeText(range: unknown): string {
  const t = text(range);
  if (!t) return "—";
  const m = /^\$\s?([\d,]+)\s*[-–]\s*\$\s?([\d,]+)$/.exec(t);
  if (!m) return t;
  const nums = [m[1], m[2]].map((x) => Number(x.replace(/,/g, "")));
  return `${compact(nums[0])}–${compact(nums[1])}`;
}

function time(s: unknown): number {
  const t = text(s);
  const ms = t ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}

/** Newest first by `date` (ISO or MM/DD/YYYY); unknown dates last; stable; input untouched. */
export function sortTrades<T extends Row>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i, t: time(r.date) }))
    .sort((a, b) => (a.t === b.t ? a.i - b.i : b.t - a.t))
    .map((x) => x.r);
}

export type Point = { price: number; at: string | null };
export type History = { series: Record<string, Point[]>; seen: Record<string, string> };
export const emptyHistory = (): History => ({ series: {}, seen: {} });
const HIST_MAX = 30;

/** History key: the watchlist is UNIQUE(symbol, kind), so "dash" the stock and the coin differ. */
export const priceKey = (r: Row): string => `${text(r.asset) ?? "stock"}:${text(r.symbol) ?? ""}`;

/**
 * Session price history per kind:symbol. The watchlist stores only the latest
 * price and when it was checked, so each distinct `last_checked` this panel
 * sees adds a point carrying that timestamp. Pure and idempotent for the same rows.
 */
export function trackPrices(prev: History, rows: Row[]): History {
  const series = { ...prev.series };
  const seen = { ...prev.seen };
  for (const r of rows) {
    const price = num(r.price);
    if (!text(r.symbol) || price === null) continue;
    const key = priceKey(r);
    const at = text(r.last_checked);
    const stamp = at ?? `p${price}`;
    if (seen[key] === stamp) continue;
    seen[key] = stamp;
    series[key] = [...(series[key] ?? []), { price, at }].slice(-HIST_MAX);
  }
  return { series, seen };
}

/**
 * Change between the last two points plus the span it covers, taken from the
 * previous point's stored timestamp ("since 6d ago"). Nothing (null, "") when
 * there is no usable previous price/timestamp, so no figure is ever invented.
 */
export function changeInfo(points: Point[], now: Date): { pct: number | null; caption: string } {
  const none = { pct: null, caption: "" };
  if (points.length < 2) return none;
  const prev = points[points.length - 2];
  const cur = points[points.length - 1];
  const t = prev.at ? utcDate(prev.at).getTime() : NaN;
  const pct = changePct(prev.price, cur.price);
  if (pct === null || !Number.isFinite(t)) return none;
  const span = ago(new Date(t), now);
  return { pct, caption: span === "just now" ? "since moments ago" : `since ${span} ago` };
}

const SHORT: Record<string, string> = { senate: "Sen", house: "Rep" };

/** Buy/Sell/... label and tone from a disclosure's transaction type. */
function typeOf(t: unknown): { type: string; tone: "up" | "down" | "flat" } {
  const s = text(t);
  if (!s) return { type: "—", tone: "flat" };
  if (/purchase|buy/i.test(s)) return { type: "Buy", tone: "up" };
  if (/sale|sell/i.test(s)) return { type: "Sell", tone: "down" };
  return { type: s, tone: "flat" };
}

/** Table cells for a congress-trade row (rows may be sparse). */
export function tradeView(r: Row) {
  const name = text(r.politician) ?? "Unknown";
  const ch = SHORT[String(r.chamber)];
  const { type, tone } = typeOf(r.transaction_type);
  return {
    id: r.id,
    who: ch ? `${name} (${ch})` : name,
    ticker: text(r.ticker) ?? "—",
    type,
    tone,
    size: tradeSizeText(r.amount_range),
    date: text(r.date) ?? "—",
  };
}

/**
 * Which data sections to render. With the tabs section visible exactly one is
 * shown (the chosen tab, or the other one if the chosen one is hidden); with
 * tabs hidden every visible data section is shown. `ids` = visible section ids.
 */
export function shownParts(ids: string[], chosen: "watchlist" | "congress") {
  const w = ids.includes("watchlist");
  const c = ids.includes("congress");
  const tab = chosen === "watchlist" ? (w || !c ? "watchlist" : "congress") : c || !w ? "congress" : "watchlist";
  if (!ids.includes("tabs")) return { tab, watchlist: w, congress: c } as const;
  return { tab, watchlist: w && tab === "watchlist", congress: c && tab === "congress" } as const;
}
