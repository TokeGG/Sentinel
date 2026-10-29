// Finance data sources: quotes, company filings index, crypto prices.
import { cap, enc, has, json, obj, str, type DataSource } from "./types.ts";

export const FINANCE_SOURCES: DataSource[] = [
  {
    id: "stooq", category: "finance", name: "Stooq quotes (CSV)", about: "Delayed quotes; symbols like aapl.us, ^spx.", sample: "aapl.us",
    request: (q) => ({ url: `https://stooq.com/q/l/?s=${enc(q.toLowerCase())}&f=sd2t2ohlcv&h&e=csv` }),
    parse: (t) => {
      const [head, ...lines] = t.trim().split(/\r?\n/);
      const cols = (head ?? "").split(",").map((c) => c.trim().toLowerCase());
      if (!cols.includes("symbol")) throw new Error("not a stooq CSV");
      return cap(lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v.trim()])))
        .filter((r) => r.close && r.close !== "N/D")
        .map((r) => ({ title: `${r.symbol} ${r.close}`, detail: `${r.date} ${r.time} · open ${r.open} high ${r.high} low ${r.low} vol ${r.volume}` })));
    },
  },
  {
    id: "sec-edgar", category: "finance", name: "SEC EDGAR company list", about: "Ticker -> company name and CIK (filings index); filtered locally.", sample: "apple",
    request: () => ({ url: "https://www.sec.gov/files/company_tickers.json" }),
    parse: (t, q) => cap(Object.values(obj(json(t))).map(obj)
      .filter((c) => has(`${str(c.ticker)} ${str(c.title)}`, q))
      .map((c) => ({ title: `${str(c.ticker)} ${str(c.title)}`, detail: `CIK ${str(c.cik_str)}`, url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${str(c.cik_str)}` }))),
  },
  {
    id: "coingecko", category: "finance", name: "CoinGecko simple price", about: "Crypto prices in USD by coin id (bitcoin, ethereum).", sample: "bitcoin,ethereum",
    request: (q) => ({ url: `https://api.coingecko.com/api/v3/simple/price?ids=${enc(q.replace(/\s+/g, ""))}&vs_currencies=usd&include_24hr_change=true` }),
    parse: (t) => cap(Object.entries(obj(json(t))).map(([id, v]) => {
      const o = obj(v), ch = Number(o.usd_24h_change);
      return { title: `${id} $${str(o.usd)}`, detail: Number.isFinite(ch) ? `24h ${ch.toFixed(2)}%` : undefined };
    })),
  },
];
