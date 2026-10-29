// Pure helpers for the Deals panel.
export { sourcesOf } from "../news/panelLogic.ts";

// "$1,299.99", "$139", "$.99", "USD 20" — first match wins. The lookahead
// rejects over-precise cents ("$12.345" -> no price, not a wrong "$12.34")
// and numbers followed by more digits.
const NUM = String.raw`(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|\.\d{1,2})(?!\d|\.\d)`;
const PRICE = new RegExp(String.raw`\$\s?${NUM}|USD\s?${NUM}`);

/** First price found in a deal title, as written; null if none. */
export function priceOf(title: string): string | null {
  return PRICE.exec(title)?.[0] ?? null;
}

/** "-25%" when the title says "25% off" (1-99); null otherwise. */
export function percentOff(title: string): string | null {
  const m = /\b(\d{1,2})\s?%\s*off\b/i.exec(title);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 99 ? `-${n}%` : null;
}
