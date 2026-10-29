// Price parsing for deal titles ("$149.99", "was $200 now $149", "25% off", "free").
// "$1,299.99", "$139", "$.99", "USD 20" — first match wins. The lookahead
// rejects over-precise cents ("$12.345" -> no price, not a wrong "$12.34")
// and numbers followed by more digits.
const NUM = String.raw`(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|\.\d{1,2})(?!\d|\.\d)`;
const MONEY = String.raw`(?:\$\s?${NUM}|USD\s?${NUM})`;
const PRICE = new RegExp(MONEY);
const WAS = new RegExp(String.raw`\b(?:was|reg(?:ular)?\.?|orig(?:inal)?\.?|msrp|list(?: price)?)\s*:?\s*(${MONEY})`, "i");
const NOW = new RegExp(String.raw`\b(?:now|for|only|just)\s*:?\s*(${MONEY})`, "i");

/** First price found in a deal title, as written; null if none. */
export function priceOf(title: string): string | null {
  return PRICE.exec(title)?.[0] ?? null;
}

const amount = (s: string | undefined): number | null => {
  const n = s ? parseFloat(s.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
};

export interface DealInfo { price: number | null; was: number | null; percent: number | null; free: boolean; band: string | null }

export function priceBand(price: number | null, free: boolean): string | null {
  if (free) return "free";
  if (price === null) return null;
  return price < 25 ? "under-25" : price < 100 ? "25-100" : price < 300 ? "100-300" : price < 1000 ? "300-1000" : "1000-plus";
}

export function dealInfo(title: string): DealInfo {
  const was = amount(WAS.exec(title)?.[1]);
  let price = amount(NOW.exec(title)?.[1]);
  if (price === null) {
    // first price that is not the "was" one
    for (const m of title.matchAll(new RegExp(MONEY, "g"))) {
      const n = amount(m[0]);
      if (n !== null && n !== was) { price = n; break; }
    }
  }
  const pct = /\b(\d{1,2})\s?%\s*off\b/i.exec(title);
  let percent = pct && Number(pct[1]) >= 1 ? Number(pct[1]) : null;
  if (percent === null && was && price !== null && price < was) percent = Math.round((1 - price / was) * 100) || null;
  const free = price === null && /\bfree\b(?!\s+(?:shipping|delivery|returns?|ship))/i.test(title);
  return { price: free ? 0 : price, was, percent, free, band: priceBand(price, free) };
}

/** "-25%" for "25% off" or a was/now pair (1-99); null otherwise. */
export function percentOff(title: string): string | null {
  const p = dealInfo(title).percent;
  return p !== null && p <= 99 ? `-${p}%` : null;
}

/** Store/brand a title names: "@ Newegg", "at Best Buy", "from Amazon"; null if none. */
export function storeOf(title: string): string | null {
  const m = /(?:\bat|@|\bfrom|\bvia)\s+([A-Z][\w&.'-]*(?:\s[A-Z][\w&.'-]*)?)/.exec(title);
  return m ? m[1].replace(/[.,]$/, "") : null;
}

/** Leading "[GPU]" style tag (r/buildapcsales); null if none. */
export const tagOf = (title: string): string | null => /^\s*\[([^\]]{2,20})\]/.exec(title)?.[1] ?? null;
