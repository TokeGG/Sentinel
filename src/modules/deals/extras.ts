// Pure Deals extras: deal identity for price history, fair-price badge, promo-code extraction, wishlist matching.
const STOP = new Set("the and for with new now off was only just deal sale save get".split(" "));
/** Lowercase words (2+ chars, numbers kept: "4070" matters for products), unique. */
export const words = (s: string): string[] => [...new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w)))];

/** Stable key for "the same product" across posts: title keywords minus prices/percents/tags, sorted. */
export function dealKey(title: string): string {
  const bare = title.replace(/^\s*\[[^\]]*\]/, "").replace(/(?:\$|USD\s?)\s?[\d.,]+/gi, " ").replace(/\d+\s?%/g, " ")
    .replace(/(?:\bat|@|\bfrom|\bvia)\s+[A-Z][\w&.'-]*(?:\s[A-Z][\w&.'-]*)?/g, " ");
  return words(bare).slice(0, 10).sort().join(" ");
}

export type Fair = "lowest" | "fair" | "high";

/** Badge for `price` against earlier prices of the same deal; needs 2+ earlier points. */
export function fairPrice(price: number | null, history: number[]): { badge: Fair; low: number; median: number } | null {
  if (price === null || history.length < 2) return null;
  const s = [...history].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  const low = s[0];
  const badge: Fair = price <= low ? "lowest" : price <= median * 1.05 ? "fair" : "high";
  return { badge, low, median };
}

const CODE = /\b(?:promo\s*code|coupon(?:\s*code)?|code)\s*[:\-]?\s*["'“]?([A-Z0-9][A-Z0-9_-]{3,19})\b/gi;
const NOT_CODE = new Set(["FREE", "THIS", "CODE", "COUPON", "PROMO", "HERE", "BELOW", "ABOVE", "WITH", "AT", "CHECKOUT"]);

/** Promo codes mentioned in text ("use code SAVE20", "Coupon: GAMER10"): upper-case, has a letter and a digit or is all caps. */
export function extractCodes(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(CODE)) {
    const raw = m[1];
    const c = raw.toUpperCase();
    if (NOT_CODE.has(c) || !/[A-Z]/.test(c)) continue;
    if (/\d/.test(c) || raw === c) out.add(c);
  }
  return [...out];
}

export type Wish = { id: number; term: string; max_price: number | null };

/** A deal matches a wish when every term word is in the title and the price is within max (if set). */
export function wishMatches(title: string, price: number | null, w: Wish): boolean {
  const need = words(w.term);
  if (!need.length) return false;
  const have = new Set(words(title));
  if (!need.every((t) => have.has(t))) return false;
  return w.max_price === null || (price !== null && price <= w.max_price);
}
