// Pure: the source link kept with deal/bill/coupon calendar items, and which items count as deals.
type Row = Record<string, unknown>;

/** http(s) URL from skill args (url | link), else null. Never javascript:/file: etc. */
export function keptUrl(a: Row | undefined): string | null {
  for (const k of ["url", "link"]) {
    const v = String(a?.[k] ?? "").trim();
    if (/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v) && v.length <= 2048) return v;
  }
  return null;
}

const DEALISH = /^(deal|bill|coupon|wishlist|promo|price)\b/i;

/** A row is a deal when it came from Deals, has origin "deal", or its title starts Deal:/Coupon:/Wishlist:... */
export const isDealRow = (r: Row) =>
  r.source === "Deals" || r.origin === "deal" || DEALISH.test(String(r.title ?? r.text ?? ""));

/** The URL the "Open deal" button opens, or null. */
export function dealLinkOf(r: Row): string | null {
  if (!isDealRow(r)) return null;
  return keptUrl({ url: r.url }) ?? keptUrl({ url: r.link });
}
