// Preloaded deal sources (public RSS/Atom feeds as far as we know — NOT verified
// from here; a source that fails just counts as failed on fetch). Seeded once.
export const CATEGORIES = [
  { id: "pc", label: "PC hardware" },
  { id: "games", label: "Games" },
  { id: "general", label: "General" },
  { id: "tech", label: "Tech" },
  { id: "home", label: "Home" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const categoryOk = (c: unknown): c is CategoryId => CATEGORIES.some((x) => x.id === c);

export interface DefaultSource { url: string; label: string; category: CategoryId }
export const DEFAULT_SOURCES: DefaultSource[] = [
  { url: "https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1", label: "Slickdeals Frontpage", category: "general" },
  { url: "https://www.reddit.com/r/buildapcsales/.rss", label: "r/buildapcsales", category: "pc" },
  { url: "https://www.reddit.com/r/LaptopDeals/.rss", label: "r/LaptopDeals", category: "pc" },
  { url: "https://www.reddit.com/r/GameDeals/.rss", label: "r/GameDeals", category: "games" },
  { url: "https://blog.humblebundle.com/rss/", label: "Humble Bundle blog", category: "games" },
  { url: "https://store.steampowered.com/feeds/news/", label: "Steam news", category: "games" },
  { url: "https://www.reddit.com/r/deals/.rss", label: "r/deals", category: "general" },
  { url: "https://www.dealnews.com/?rss=1", label: "DealNews", category: "general" },
  { url: "https://9to5toys.com/feed/", label: "9to5Toys", category: "tech" },
  { url: "https://www.reddit.com/r/frugal/.rss", label: "r/frugal", category: "home" },
];
