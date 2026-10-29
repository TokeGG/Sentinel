// Pure News extras: topic boosts, duplicate story grouping, reliability labels, preset feeds, audio enclosures.
import { tokens } from "../../core/taste/features.ts";

type Row = Record<string, unknown>;

export const RELIABILITY = ["", "reliable", "mixed", "opinion", "unreliable", "satire"] as const;
export const reliabilityOk = (v: unknown): v is string => typeof v === "string" && (RELIABILITY as readonly string[]).includes(v);

/** Normalised topic term (lowercase, single spaces, 2-40 chars) or null. */
export function cleanTopic(s: string): string | null {
  const t = s.toLowerCase().replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= 40 ? t : null;
}

/** Topics a title mentions: every token of the topic appears among the title's tokens. */
export function topicsIn(title: string, topics: string[]): string[] {
  const have = new Set(tokens(title, 40));
  return topics.filter((t) => {
    const need = tokens(t, 10);
    return need.length > 0 && need.every((w) => have.has(w));
  });
}

/** Stable: rows matching any followed topic first (more matches first), the rest keep their order. */
export function boostByTopics<T extends Row>(rows: T[], topics: string[]): T[] {
  if (!topics.length) return rows;
  return rows
    .map((r, i) => ({ r, i, n: topicsIn(String(r.title ?? ""), topics).length }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.r);
}

/** Jaccard similarity of two titles' keyword sets (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const x = new Set(tokens(a, 40));
  const y = new Set(tokens(b, 40));
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

export const SAME_STORY = 0.5;

/** Groups rows telling the same story (similar titles); the first row of each group leads. */
export function groupStories<T extends Row>(rows: T[], threshold = SAME_STORY): { lead: T; more: T[] }[] {
  const groups: { lead: T; more: T[] }[] = [];
  for (const r of rows) {
    const t = String(r.title ?? "");
    const g = groups.find((g) => titleSimilarity(String(g.lead.title ?? ""), t) >= threshold);
    if (g) g.more.push(r);
    else groups.push({ lead: r, more: [] });
  }
  return groups;
}

export const isAudio = (type: unknown, url: unknown): boolean =>
  (typeof type === "string" && type.startsWith("audio/")) || (typeof url === "string" && /^https:\/\/[^\s]+\.(mp3|m4a|ogg|opus|aac)(\?|$)/i.test(url));

/** Only https media URLs are handed to <audio>. */
export const audioSrc = (url: unknown): string | null => (typeof url === "string" && /^https:\/\//i.test(url) ? url : null);

// Opt-in preset feeds (seeded only when the user presses the preset's button). URLs unverified on a live run.
export const PRESETS: Record<string, { label: string; tag: string; feeds: { url: string; label: string }[] }> = {
  games: { label: "Game news", tag: "games", feeds: [
    { url: "https://www.pcgamer.com/rss/", label: "PC Gamer" },
    { url: "https://www.rockpapershotgun.com/feed", label: "Rock Paper Shotgun" },
    { url: "https://www.gamespot.com/feeds/news/", label: "GameSpot" },
  ] },
  patches: { label: "Patch notes", tag: "patch notes", feeds: [
    { url: "https://store.steampowered.com/feeds/news/app/730/", label: "Counter-Strike 2 news" },
    { url: "https://store.steampowered.com/feeds/news/app/570/", label: "Dota 2 news" },
    { url: "https://store.steampowered.com/feeds/news/app/440/", label: "TF2 news" },
  ] },
  sports: { label: "Sports ticker", tag: "sports", feeds: [
    { url: "https://www.espn.com/espn/rss/news", label: "ESPN" },
    { url: "https://www.espn.com/espn/rss/nfl/news", label: "ESPN NFL" },
    { url: "https://www.espn.com/espn/rss/nba/news", label: "ESPN NBA" },
  ] },
};

/** Newest rows from sources tagged "sports", for the ticker strip. */
export const tickerRows = <T extends Row>(rows: T[], n = 8): T[] => rows.filter((r) => r.tag === "sports").slice(0, n);

export type NewsView = "all" | "topics" | "later" | "highlights";
export const VIEWS: { id: NewsView; label: string }[] = [
  { id: "all", label: "All" }, { id: "topics", label: "My topics" }, { id: "later", label: "Read later" }, { id: "highlights", label: "Highlights" },
];

/** Rows for a view: topics = only matches, boosted; later/highlights = saved rows. */
export function viewRows<T extends Row>(rows: T[], view: NewsView, topics: string[]): T[] {
  if (view === "later") return rows.filter((r) => Number(r.later) === 1);
  if (view === "highlights") return rows.filter((r) => typeof r.highlight === "string" && r.highlight !== "");
  if (view === "topics") return boostByTopics(rows.filter((r) => topicsIn(String(r.title ?? ""), topics).length > 0), topics);
  return rows;
}
