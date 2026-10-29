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
