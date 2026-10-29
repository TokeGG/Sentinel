// Deals extras in SQLite (migration 39): price history, promo codes, wishlist + hits (counts-only moon).
import { getDb } from "../../core/db";
import { dealKey, extractCodes, fairPrice, wishMatches, type Wish } from "./extras";
import { dealInfo, storeOf } from "./price";

type Db = Awaited<ReturnType<typeof getDb>>;
const today = () => new Date().toISOString().slice(0, 10);

/** Called for each newly stored offer during a fetch. */
export async function onNewOffer(d: Db, offerId: number, title: string, summary: string, source: string): Promise<void> {
  const price = dealInfo(title).price;
  if (price !== null) await d.execute("INSERT OR REPLACE INTO deal_prices (deal_key, price, seen_on) VALUES ($1,$2,$3)", [dealKey(title), price, today()]);
  for (const code of extractCodes(`${title} ${summary}`))
    await d.execute("INSERT OR IGNORE INTO deal_coupons (code, store, note) VALUES ($1,$2,$3)", [code, storeOf(title) ?? source, title.slice(0, 200)]);
  for (const w of await d.select<Wish[]>("SELECT * FROM deal_wishlist"))
    if (wishMatches(title, price, w)) await d.execute("INSERT OR IGNORE INTO deal_wish_hits (wish_id, offer_id) VALUES ($1,$2)", [w.id, offerId]);
}

/** Adds `fair` (price badge) and `wished` to loaded offer rows. */
export async function decorate(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const hist = new Map<string, { price: number; seen_on: string }[]>();
  for (const p of await d.select<{ deal_key: string; price: number; seen_on: string }[]>("SELECT * FROM deal_prices ORDER BY seen_on"))
    hist.set(p.deal_key, [...(hist.get(p.deal_key) ?? []), p]);
  const hits = new Set((await d.select<{ offer_id: number }[]>("SELECT DISTINCT offer_id FROM deal_wish_hits")).map((h) => h.offer_id));
  return rows.map((r) => {
    const t = String(r.title ?? "");
    const h = hist.get(dealKey(t)) ?? [];
    const price = dealInfo(t).price;
    // Earlier points exclude today's own record so a single post isn't compared to itself.
    const earlier = h.filter((p) => p.seen_on !== today()).map((p) => p.price);
    return { ...r, fair: fairPrice(price, earlier)?.badge ?? null, history: h.map((p) => p.price), wished: hits.has(Number(r.id)) };
  });
}

export const listWishes = async () => (await getDb()).select<Wish[]>("SELECT * FROM deal_wishlist ORDER BY term");

export async function addWish(args?: Record<string, unknown>) {
  const term = String(args?.term ?? "").trim();
  if (term.length < 2) throw new Error("wish term is empty");
  const max = Number(args?.max_price);
  await (await getDb()).execute("INSERT INTO deal_wishlist (term, max_price) VALUES ($1,$2)", [term, Number.isFinite(max) && max > 0 ? max : null]);
  return { ok: true };
}

export async function removeWish(args?: Record<string, unknown>) {
  const d = await getDb();
  await d.execute("DELETE FROM deal_wish_hits WHERE wish_id = $1", [Number(args?.id)]);
  await d.execute("DELETE FROM deal_wishlist WHERE id = $1", [Number(args?.id)]);
  return { ok: true };
}

export async function unseenWishHits(): Promise<number> {
  const r = await (await getDb()).select<{ n: number }[]>("SELECT COUNT(*) AS n FROM deal_wish_hits WHERE seen = 0");
  return Number(r[0]?.n ?? 0);
}

export async function markWishesSeen() {
  await (await getDb()).execute("UPDATE deal_wish_hits SET seen = 1 WHERE seen = 0");
  return { ok: true };
}

export type Coupon = { code: string; store: string; note: string; expires: string };
export const listCoupons = async () => (await getDb()).select<Coupon[]>("SELECT * FROM deal_coupons ORDER BY added_at DESC LIMIT 200");

export async function addCoupon(args?: Record<string, unknown>) {
  const code = String(args?.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new Error("code must be 3-30 letters/digits");
  await (await getDb()).execute("INSERT OR REPLACE INTO deal_coupons (code, store, note, expires) VALUES ($1,$2,$3,$4)",
    [code, String(args?.store ?? "").trim(), String(args?.note ?? "").trim(), String(args?.expires ?? "").trim()]);
  return { ok: true };
}

export async function removeCoupon(args?: Record<string, unknown>) {
  await (await getDb()).execute("DELETE FROM deal_coupons WHERE code = $1 AND store = $2", [String(args?.code), String(args?.store ?? "")]);
  return { ok: true };
}
