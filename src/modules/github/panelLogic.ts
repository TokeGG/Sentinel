// Pure helpers for the GitHub Discovery panel.
import { safeLink } from "../../ui/safeLink.ts";

type Row = Record<string, unknown>;
export type Tab = "trending" | "starred";

export const githubSections = [
  { id: "credentials", label: "GitHub token" },
  { id: "tabs", label: "Trending / Starred tabs" },
  { id: "repos", label: "Repositories" },
  { id: "cloned", label: "Cloned repos" },
  { id: "actions", label: "Fetch repos" },
];

/** 999 -> "999", 1234 -> "1.2k", 98150 -> "98.2k", 1.2M -> "1.2M"; bad input -> "0". */
export function starsText(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(Math.round(n));
  const k = Math.round(n / 100) / 10;
  if (k < 1000) return `${k}k`;
  return `${Math.round(n / 100_000) / 10}M`;
}

const LANG: Record<string, string> = {
  typescript: "#3178c6", javascript: "#f1e05a", python: "#3572a5", rust: "#dea584", go: "#00add8",
  java: "#b07219", c: "#555555", "c++": "#f34b7d", "c#": "#178600", ruby: "#701516", swift: "#f05138",
  kotlin: "#a97bff", php: "#4f5d95", shell: "#89e051", html: "#e34c26", css: "#563d7c", lua: "#000080",
  zig: "#ec915c", dart: "#00b4ab", vue: "#41b883",
};

// Color for a language dot: the table for known names, else a stable hue from a hash of the name.
export function languageColor(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) return null;
  const key = name.trim().toLowerCase();
  if (LANG[key]) return LANG[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 55%)`;
}

/** The load() row carries `cloned: true` when the repo url is in cloned_repos. */
export const isCloned = (r: Row): boolean => r.cloned === true;

/** Collapse whitespace and cut to `max` chars with an ellipsis. */
export function shortText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)) + "…";
}

/** Display fields for a repo row; falls back to the old "name ★n" title for sparse rows. */
export function repoView(r: Row) {
  const title = typeof r.title === "string" ? r.title : "";
  const m = /^(.*?)\s*★(\d+)\s*$/.exec(title);
  const name = typeof r.name === "string" && r.name ? r.name : (m?.[1] ?? title) || String(r.id ?? "");
  const stars = typeof r.stars === "number" ? r.stars : m ? Number(m[2]) : 0;
  const language = typeof r.language === "string" && r.language.trim() ? r.language.trim() : null;
  const description = shortText(r.description ?? r.label, 140);
  return {
    name,
    stars: starsText(stars),
    language,
    color: languageColor(language),
    description,
    link: safeLink(r.link),
    cloned: isCloned(r),
  };
}

const isTab = (v: unknown): v is Tab => v === "trending" || v === "starred";

/** The tab to show: the user's choice, else what the loaded rows came from, else trending. */
export function activeTab(chosen: Tab | null, rows: Row[]): Tab {
  if (chosen) return chosen;
  const s = rows[0]?.source;
  return isTab(s) ? s : "trending";
}

/** Rows belonging to a tab (rows without a source are shown everywhere). */
export const rowsForTab = (rows: Row[], tab: Tab): Row[] => rows.filter((r) => !isTab(r.source) || r.source === tab);

export const skillForTab = (tab: Tab) => (tab === "starred" ? "fetch_starred" : "fetch_trending");
export const tabForSkill = (skill: string): Tab => (skill === "fetch_starred" ? "starred" : "trending");
