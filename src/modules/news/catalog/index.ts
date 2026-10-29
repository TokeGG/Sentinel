// The News source catalog: category -> curated feeds. Seeded once per url (only missing, never re-added
// after the user removes one); every entry is "unverified" until Check sources fetches it.
import type { CatalogEntry } from "../sources/logic.ts";
import { BUSINESS } from "./business.ts";
import { GAMING } from "./gaming.ts";
import { PODCASTS } from "./podcasts.ts";
import { POLITICS } from "./politics.ts";
import { SCIENCE } from "./science.ts";
import { SPORTS } from "./sports.ts";
import { TECH } from "./tech.ts";
import { WORLD } from "./world.ts";

export const NEWS_CATEGORIES = [
  { id: "world", label: "World & US", feeds: WORLD },
  { id: "tech", label: "Tech", feeds: TECH },
  { id: "business", label: "Business & finance", feeds: BUSINESS },
  { id: "science", label: "Science", feeds: SCIENCE },
  { id: "gaming", label: "Gaming & game news", feeds: GAMING },
  { id: "sports", label: "Sports", feeds: SPORTS },
  { id: "politics", label: "Politics", feeds: POLITICS },
  { id: "podcasts", label: "Podcasts", feeds: PODCASTS },
];

export const NEWS_CATALOG: CatalogEntry[] = NEWS_CATEGORIES.flatMap((c) => c.feeds.map(([url, label]) => ({ url, label, category: c.id })));
