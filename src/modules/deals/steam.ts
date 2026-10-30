// Pure Steam wishlist helpers (button press only, public profiles, no key):
// profile input -> steamid64 or vanity; community ?xml=1 -> steamid64; IWishlistService -> appids; appdetails -> name.
// Epic has no public wishlist endpoint, so only Steam is synced.
export type SteamTarget = { id: string } | { vanity: string };

/** "7656119...", ".../profiles/<id>", ".../id/<vanity>" or a bare vanity name. */
export function steamTarget(input: string): SteamTarget | null {
  const t = input.trim().replace(/\/+$/, "");
  const prof = /(?:profiles\/)?(7656\d{13})$/.exec(t);
  if (prof) return { id: prof[1] };
  const v = /(?:steamcommunity\.com\/id\/)?([A-Za-z0-9_-]{2,32})$/.exec(t);
  return v && !t.includes(" ") ? { vanity: v[1] } : null;
}

export const vanityUrl = (v: string) => `https://steamcommunity.com/id/${encodeURIComponent(v)}/?xml=1`;
export const wishlistUrl = (id: string) => `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${id}`;
export const appUrl = (appid: number) => `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`;

/** steamID64 from the community profile XML; null when private/unknown. */
export function parseProfileXml(xml: string): string | null {
  return /<steamID64>\s*(7656\d{13})\s*<\/steamID64>/.exec(xml)?.[1] ?? null;
}

/** App ids from GetWishlist JSON ({response:{items:[{appid}]}}), highest priority first as given. */
export function parseWishlist(json: unknown): number[] {
  const items = (json as { response?: { items?: { appid?: unknown }[] } })?.response?.items;
  if (!Array.isArray(items)) return [];
  return [...new Set(items.map((i) => Number(i?.appid)).filter((n) => Number.isInteger(n) && n > 0))];
}

/** Game name from appdetails JSON; null when missing/failed. */
export function parseAppName(json: unknown, appid: number): string | null {
  const e = (json as Record<string, { success?: boolean; data?: { name?: unknown } }>)?.[String(appid)];
  const n = e?.success ? e.data?.name : null;
  return typeof n === "string" && n.trim() ? n.trim().slice(0, 120) : null;
}

/** Names not already a wish term (case-insensitive). */
export const newWishes = (names: string[], terms: string[]) => {
  const have = new Set(terms.map((t) => t.toLowerCase()));
  return [...new Set(names)].filter((n) => !have.has(n.toLowerCase()));
};
