// URL builders for the deal catalog: Slickdeals search RSS, subreddit RSS and in-subreddit search RSS.
// These are the documented public patterns; each seeded feed is still "unverified" until Check sources.
import type { CatalogEntry } from "../../news/sources/logic.ts";

export const sd = (q: string, category: string): CatalogEntry => ({
  url: `https://slickdeals.net/newsearch.php?src=SearchBarV2&q=${encodeURIComponent(q)}&searcharea=deals&searchin=first&rss=1`,
  label: `Slickdeals: ${q}`, category,
});
export const rd = (sub: string, category: string): CatalogEntry => ({ url: `https://www.reddit.com/r/${sub}/.rss`, label: `r/${sub}`, category });
export const rs = (sub: string, q: string, category: string): CatalogEntry => ({
  url: `https://www.reddit.com/r/${sub}/search.rss?q=${encodeURIComponent(q)}&restrict_sr=on&sort=new`, label: `r/${sub}: ${q}`, category,
});
export const feed = (url: string, label: string, category: string): CatalogEntry => ({ url, label, category });
export const many = (qs: string[], category: string) => qs.map((q) => sd(q, category));
