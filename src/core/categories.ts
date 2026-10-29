// Panel-bot categories (manifest `category`): which skills, knowledge base and data sources a panel's
// Ask bar uses. Modules that do not declare one fall back to DEFAULT_CATEGORY by id, then "productivity".
export const CATEGORIES = ["news", "deals", "finance", "mail", "media", "social", "dev", "system", "lab", "productivity"] as const;
export type Category = (typeof CATEGORIES)[number];

export const isCategory = (v: unknown): v is Category => typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);

export const DEFAULT_CATEGORY: Record<string, Category> = {
  "hub.news": "news", "hub.congress": "news", "hub.weather": "news",
  "hub.deals": "deals", "hub.finance": "finance", "hub.email": "mail",
  "hub.youtube": "media", "hub.media": "media", "hub.games": "media", "hub.discord": "social",
  "hub.chat": "social", "hub.social": "social", "hub.github": "dev", "hub.skills": "dev", "hub.bot": "dev",
  "hub.pccare": "system", "hub.homenet": "system", "hub.backup": "system", "hub.filesearch": "system",
  "hub.clipboard": "productivity", "hub.notes": "productivity", "hub.calendar": "productivity", "hub.browser": "productivity",
  "hub.pentest": "lab",
};

export function categoryOf(m: { id: string; category?: string }): Category {
  return isCategory(m.category) ? m.category : DEFAULT_CATEGORY[m.id] ?? "productivity";
}

export function categoryError(c: unknown): string | null {
  return c === undefined || isCategory(c) ? null : `category must be one of ${CATEGORIES.join(", ")}, got ${JSON.stringify(c)}`;
}

/** A skill's `category:` frontmatter, a comma/space list ("news, deals"); unknown words are dropped. */
export function parseCategoryList(v: string | undefined): Category[] {
  return [...new Set((v ?? "").split(/[\s,]+/).filter(isCategory))];
}
