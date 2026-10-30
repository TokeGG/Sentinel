// Pure quote parsers (no Tauri/DB). Each returns a Quote or throws an Error whose
// message is shown on the symbol's tile, so a bad answer is never silent.
export interface Quote {
  price: number;
  change: number | null; // absolute, vs previous close (or open when no prev close)
  pct: number | null;
  at: string | null; // ISO time of the quote, when the provider gives one
  source: string;
}

const fin = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.trim()) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export function withChange(price: number, prev: number | null, at: string | null, source: string): Quote {
  const change = prev !== null && prev !== 0 ? price - prev : null;
  const pct = change !== null && prev ? (change / prev) * 100 : null;
  return { price, change, pct, at, source };
}

/** "AAPL" -> "aapl.us"; keeps an explicit market suffix ("vod.uk", "aapl.us"); "^spx" stays. */
export function stooqSymbol(sym: string): string {
  const s = sym.trim().toLowerCase();
  if (s.startsWith("^") || /\.[a-z]{2}$/.test(s)) return s;
  return `${s.replace(/\./g, "-")}.us`;
}

/** Yahoo wants "BRK-B"; a Stooq-style ".us" suffix is dropped. */
export function yahooSymbol(sym: string): string {
  return sym.trim().toUpperCase().replace(/\.US$/, "").replace(/\./g, "-");
}

/** Stooq CSV (header row + one data row); columns found by header name. */
export function parseStooq(csv: string): Quote {
  const lines = csv.replace(/\r/g, "").trim().split("\n").filter(Boolean);
  if (lines.length < 2) throw new Error("Stooq: empty answer");
  const head = lines[0].toLowerCase().split(",");
  const cols = lines[1].split(",");
  const get = (name: string) => { const i = head.indexOf(name); return i < 0 ? undefined : cols[i]; };
  const close = fin(get("close"));
  if (close === null) throw new Error(cols.includes("N/D") ? "Stooq: unknown symbol (N/D)" : "Stooq: no price in answer");
  const prev = fin(get("prev")) ?? fin(get("open"));
  const date = get("date"), time = get("time");
  const at = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T${time && /^\d{2}:\d{2}/.test(time) ? time : "00:00:00"}` : null;
  return withChange(close, prev, at, "Stooq");
}

/** Yahoo chart API v8: chart.result[0].meta. */
export function parseYahoo(json: unknown): Quote {
  const chart = (json as { chart?: { result?: { meta?: Record<string, unknown> }[] | null; error?: { description?: string } | null } })?.chart;
  if (chart?.error) throw new Error(`Yahoo: ${chart.error.description ?? "error"}`);
  const meta = chart?.result?.[0]?.meta;
  const price = fin(meta?.regularMarketPrice);
  if (price === null) throw new Error("Yahoo: no price in answer");
  const prev = fin(meta?.previousClose) ?? fin(meta?.chartPreviousClose);
  const t = fin(meta?.regularMarketTime);
  return withChange(price, prev, t ? new Date(t * 1000).toISOString() : null, "Yahoo");
}

/** Finnhub /quote: { c, d, dp, pc, t }; c = 0 means unknown symbol. */
export function parseFinnhub(json: unknown): Quote {
  const j = (json ?? {}) as Record<string, unknown>;
  if (typeof j.error === "string") throw new Error(`Finnhub: ${j.error}`);
  const price = fin(j.c);
  if (!price) throw new Error("Finnhub: unknown symbol");
  const t = fin(j.t);
  return withChange(price, fin(j.pc), t ? new Date(t * 1000).toISOString() : null, "Finnhub");
}

/** Alpha Vantage GLOBAL_QUOTE. */
export function parseAlphaVantage(json: unknown): Quote {
  const j = (json ?? {}) as Record<string, unknown>;
  const note = j.Note ?? j.Information ?? j["Error Message"];
  if (typeof note === "string") throw new Error(`Alpha Vantage: ${note.slice(0, 120)}`);
  const q = (j["Global Quote"] ?? {}) as Record<string, unknown>;
  const price = fin(q["05. price"]);
  if (price === null) throw new Error("Alpha Vantage: unknown symbol");
  const day = q["07. latest trading day"];
  return withChange(price, fin(q["08. previous close"]), typeof day === "string" ? `${day}T00:00:00` : null, "Alpha Vantage");
}

/** CoinGecko simple/price with include_24hr_change + include_last_updated_at. */
export function parseCoinGecko(json: unknown, id: string): Quote {
  const e = (json ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const row = e[id.toLowerCase()];
  const price = fin(row?.usd);
  if (price === null) throw new Error(`CoinGecko: unknown coin id "${id}" (use the CoinGecko id, e.g. bitcoin)`);
  const pct = fin(row?.usd_24h_change);
  const change = pct !== null ? price - price / (1 + pct / 100) : null;
  const t = fin(row?.last_updated_at);
  return { price, change, pct, at: t ? new Date(t * 1000).toISOString() : null, source: "CoinGecko" };
}
