// Pure config for the Social panel's tabs. X / Facebook / Instagram have no usable API for
// personal accounts, so their tabs embed the real site (Rust `embed_show`) with a persistent
// login profile each (same profile names the old standalone panels used).
export const EMBED_TAB_H = 32; // keep in sync with EMBED_TAB_H in src-tauri/src/panels/geometry.rs (test)
export const FEED_TAB = "feed";

export type EmbedSite = { id: string; label: string; url: string; profile: string; hosts: string[] };

export const SOCIAL_SITES: EmbedSite[] = [
  { id: "x", label: "X", url: "https://x.com/home", profile: "x", hosts: ["x.com", "*.x.com", "twitter.com", "*.twitter.com", "*.twimg.com"] },
  { id: "facebook", label: "Facebook", url: "https://www.facebook.com", profile: "facebook", hosts: ["facebook.com", "*.facebook.com", "fb.com", "*.fbcdn.net"] },
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com", profile: "instagram", hosts: ["instagram.com", "*.instagram.com", "*.cdninstagram.com", "*.fbcdn.net"] },
];

export const FOLLOWS_TAB = "follows";
export const SOCIAL_TABS = [{ id: FEED_TAB, label: "Feed" }, { id: FOLLOWS_TAB, label: "Following & Likes" }, ...SOCIAL_SITES.map(({ id, label }) => ({ id, label }))];

/** A stored/unknown value -> a valid tab id (Feed when unrecognised). */
export const parseTab = (raw: unknown): string => (SOCIAL_TABS.some((t) => t.id === raw) ? (raw as string) : FEED_TAB);
export const siteOf = (tab: string): EmbedSite | undefined => SOCIAL_SITES.find((s) => s.id === tab);
