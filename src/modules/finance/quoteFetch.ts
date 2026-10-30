// Provider chain for one symbol. Requests go through the Rust `oauth_http` command
// (no webview Origin header, explicit User-Agent); falls back to the http plugin
// only when that command is not registered. Every provider failure is kept so the
// tile can say why no price showed.
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { getCredential } from "../../core/credentials";
import {
  parseAlphaVantage, parseCoinGecko, parseFinnhub, parseStooq, parseYahoo,
  stooqSymbol, yahooSymbol, type Quote,
} from "./quoteParse";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel", Accept: "*/*" };

async function get(url: string): Promise<string> {
  const host = new URL(url).host;
  let status: number, body: string;
  try {
    ({ status, body } = await invoke<{ status: number; body: string }>("oauth_http", { method: "GET", url, headers: UA, body: null }));
  } catch (e) {
    if (!/not found|unknown command/i.test(String(e))) throw new Error(String(e));
    const res = await fetch(url, { headers: UA });
    status = res.status;
    body = await res.text();
  }
  if (status < 200 || status >= 300) throw new Error(`${host} answered HTTP ${status}`);
  return body;
}

const enc = encodeURIComponent;
type Provider = { name: string; run: (sym: string) => Promise<Quote> };

async function keyed(name: string, key: string, run: (k: string) => Promise<Quote>): Promise<Quote> {
  const k = await getCredential("hub.finance", key).catch(() => null);
  if (!k) throw new Error(`${name}: no API key saved (optional)`);
  return run(k);
}

export const STOCK_PROVIDERS: Provider[] = [
  { name: "Stooq", run: async (s) => parseStooq(await get(`https://stooq.com/q/l/?s=${enc(stooqSymbol(s))}&f=sd2t2ohlcv&h&e=csv`)) },
  { name: "Yahoo", run: async (s) => parseYahoo(JSON.parse(await get(`https://query1.finance.yahoo.com/v8/finance/chart/${enc(yahooSymbol(s))}?interval=1d&range=5d`))) },
  { name: "Finnhub", run: (s) => keyed("Finnhub", "finnhub_key", async (k) => parseFinnhub(JSON.parse(await get(`https://finnhub.io/api/v1/quote?symbol=${enc(yahooSymbol(s))}&token=${enc(k)}`)))) },
  { name: "Alpha Vantage", run: (s) => keyed("Alpha Vantage", "alphavantage_key", async (k) => parseAlphaVantage(JSON.parse(await get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${enc(yahooSymbol(s))}&apikey=${enc(k)}`)))) },
];

export async function fetchCrypto(id: string): Promise<Quote> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${enc(id.toLowerCase())}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;
  return parseCoinGecko(JSON.parse(await get(url)), id);
}

/** First provider that answers wins; otherwise throws with every reason joined. */
export async function fetchStock(sym: string, providers = STOCK_PROVIDERS): Promise<Quote> {
  const errs: string[] = [];
  for (const p of providers) {
    try { return await p.run(sym); } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!/no API key saved/.test(m)) errs.push(m.startsWith(p.name) ? m : `${p.name}: ${m}`);
    }
  }
  throw new Error(errs.join(" · ") || "no provider answered");
}
