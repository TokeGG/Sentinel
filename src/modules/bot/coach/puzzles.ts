// Puzzle sources for the Challenge Coach, pure: Advent of Code keys/URLs + page-to-text, pasted puzzles, bundled practice.
export type Source = "aoc" | "paste" | "practice" | "ctf" | "gen" | "quiz" | "ctfgen";
export interface Puzzle { key: string; source: Source; title: string; statement: string; input: string | null; notes?: string }

export const AOC_HOST = "adventofcode.com";
export const aocKey = (year: number, day: number) => `aoc:${year}:${day}`;
export function validAoc(year: number, day: number, now = new Date()): boolean {
  return Number.isInteger(year) && Number.isInteger(day) && year >= 2015 && year <= now.getUTCFullYear() && day >= 1 && day <= 25;
}
export function parseAocKey(key: string): { year: number; day: number } | null {
  const m = /^aoc:(\d{4}):(\d{1,2})$/.exec(key);
  return m ? { year: +m[1], day: +m[2] } : null;
}
/** Today's AoC puzzle (puzzles unlock at midnight US Eastern = 05:00 UTC, Dec 1-25), else null. */
export function todayAoc(now: Date): { year: number; day: number } | null {
  const t = new Date(now.getTime() - 5 * 3600_000);
  return t.getUTCMonth() === 11 && t.getUTCDate() <= 25 ? { year: t.getUTCFullYear(), day: t.getUTCDate() } : null;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const decode = (s: string) => s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) =>
  ENT[e] ?? (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : m));

/** The puzzle text from an AoC day page: every <article class="day-desc">, tags stripped, code/paragraph breaks kept. */
export function aocPageText(html: string): { title: string; text: string } {
  const arts = [...html.matchAll(/<article class="day-desc">([\s\S]*?)<\/article>/g)].map((m) => m[1]);
  const body = (arts.length ? arts : [html]).join("\n\n");
  const title = decode(/<h2>([\s\S]*?)<\/h2>/.exec(body)?.[1].replace(/<[^>]+>/g, "") ?? "").replace(/^-+\s*|\s*-+$/g, "").trim();
  const text = decode(body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|pre|h2|li|ul)>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, ""))
    .replace(/\n{3,}/g, "\n\n").trim();
  return { title: title || "Advent of Code puzzle", text };
}

/** A problem statement pasted from any site: first non-empty line is the title; text is trimmed and capped. */
export function parsePasted(text: string, now = Date.now()): Puzzle | null {
  const t = text.replace(/\r\n/g, "\n").trim().slice(0, 20000);
  if (t.length < 20) return null;
  const title = t.split("\n").find((l) => l.trim())!.trim().replace(/^#+\s*/, "").slice(0, 80);
  return { key: `paste:${now}`, source: "paste", title, statement: t, input: null };
}

/** Split a pasted statement into statement + optional input after a line "INPUT:" (owner convention). */
export function splitInput(p: Puzzle): Puzzle {
  const i = p.statement.search(/^INPUT:\s*$/m);
  return i < 0 ? p : { ...p, statement: p.statement.slice(0, i).trim(), input: p.statement.slice(i).replace(/^INPUT:\s*\n?/, "") };
}

/** A CTF challenge pasted by the owner (plus optional output they gathered themselves). Study only: nothing is fetched or run. */
export function parseCtf(desc: string, gathered: string, now = Date.now()): Puzzle | null {
  const p = parsePasted(desc, now);
  return p && { ...p, key: `ctf:${now}`, source: "ctf", input: gathered.trim() ? gathered.trim().slice(0, 20000) : null };
}
