// Pure: the newspaper front page. Sections from the source catalog category (or the source tag),
// trending = how many distinct sources carry the same story (duplicate groups) + recency + taste.
import { NEWS_CATALOG } from "./catalog/index.ts";
import { groupStories } from "./extras.ts";
import { sourceLabel } from "./panelLogic.ts";
import { utcDate } from "../../ui/kit/format.ts";

type Row = Record<string, unknown>;

export const SECTIONS = [
  { id: "front", label: "Front page" }, { id: "world", label: "World" }, { id: "us", label: "US" },
  { id: "politics", label: "Politics" }, { id: "business", label: "Business" }, { id: "tech", label: "Tech" },
  { id: "science", label: "Science" }, { id: "sports", label: "Sports" }, { id: "gaming", label: "Gaming" },
  { id: "congress", label: "Congress" }, { id: "foryou", label: "For you" }, { id: "later", label: "Read later" },
  { id: "sources", label: "Sources" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

const CAT = new Map(NEWS_CATALOG.map((c) => [c.url, c.category]));
const TAG: Record<string, string> = { games: "gaming", "patch notes": "gaming", sports: "sports", tech: "tech", politics: "politics", business: "business", science: "science", world: "world", us: "us" };
const US = /\b(u\.?s\.?|usa|america|npr|cnn|nbc|abc news|cbs|fox|politico|the hill|washington|new york)\b/i;

/** Newspaper section of a row: catalog category, else its source tag; "world" splits into world/us. */
export function sectionOf(r: Row): string {
  const cat = CAT.get(String(r.source_url ?? "")) ?? TAG[String(r.tag ?? "")] ?? "";
  if (cat === "world" && US.test(`${sourceLabel(r)} ${r.source_url ?? ""}`)) return "us";
  return cat;
}

export interface Story<T> { lead: T; more: T[]; sources: number; score: number }

const ageHours = (r: Row, now: number) => {
  const s = [r.published_at, r.fetched_at].find((v) => typeof v === "string" && v) as string | undefined;
  const t = s ? utcDate(s).getTime() : NaN;
  return Number.isFinite(t) ? Math.max(0, (now - t) / 3.6e6) : 48;
};

/** Stories ranked by trending score: 1 point per extra covering source, recency (half-life 12h), taste (-1..1). */
export function trending<T extends Row>(rows: T[], now: number, taste: (r: T) => number = () => 0): Story<T>[] {
  return groupStories(rows)
    .map(({ lead, more }) => {
      const sources = new Set([lead, ...more].map(sourceLabel)).size;
      const fresh = Math.pow(0.5, ageHours(lead, now) / 12);
      const t = Math.max(-1, Math.min(1, taste(lead)));
      return { lead, more, sources, score: (sources - 1) + 2 * fresh + 0.5 * t };
    })
    .sort((a, b) => b.score - a.score);
}

/** Lead story (prefers one with an image among the top 3), then the rest in order. */
export function frontPage<T extends Row>(stories: Story<T>[]): { lead: Story<T> | null; rest: Story<T>[] } {
  if (!stories.length) return { lead: null, rest: [] };
  const i = Math.max(0, stories.slice(0, 3).findIndex((s) => typeof s.lead.image === "string" && s.lead.image));
  return { lead: stories[i], rest: stories.filter((_, j) => j !== i) };
}

/** Masthead line: weekday, date and edition (morning before 12, afternoon before 18, evening). */
export function masthead(d: Date): { date: string; edition: string } {
  const date = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const h = d.getHours();
  return { date, edition: h < 12 ? "Morning edition" : h < 18 ? "Afternoon edition" : "Evening edition" };
}

/** Only https images go into <img>. */
export const imageSrc = (u: unknown): string | null => (typeof u === "string" && /^https:\/\/\S+$/i.test(u) ? u : null);
