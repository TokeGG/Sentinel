// Deal category pages + store pages, and the curated feeds behind them (catalog/lists.ts). Public RSS
// patterns as far as we know — NOT verified from here; each starts "unverified" until Check sources.
import { GAMES, GENERAL, HOME, PC, STORES, TECH } from "./catalog/lists.ts";

export const CATEGORIES = [
  { id: "pc", label: "PC hardware" },
  { id: "games", label: "Games" },
  { id: "general", label: "General" },
  { id: "tech", label: "Tech" },
  { id: "home", label: "Home" },
  { id: "amazon", label: "Amazon" },
  { id: "newegg", label: "Newegg" },
  { id: "bestbuy", label: "Best Buy" },
  { id: "steam", label: "Steam" },
  { id: "epic", label: "Epic freebies" },
  { id: "gog", label: "GOG" },
  { id: "humble", label: "Humble" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const categoryOk = (c: unknown): c is CategoryId => CATEGORIES.some((x) => x.id === c);

export interface DefaultSource { url: string; label: string; category: string }
export const DEFAULT_SOURCES: DefaultSource[] = [...PC, ...GAMES, ...GENERAL, ...TECH, ...HOME, ...STORES];
