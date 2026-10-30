// Spoiler auto-mute + generic word lists (pure). The spoiler list is app_settings `spoiler_words`
// (JSON array) and hides matching items in Chat, Social and News until the user presses Reveal.
export const SPOILER_KEY = "spoiler_words";
const MAX = 100;

/** "a, b\nc" -> ["a","b","c"]: trimmed, lower case, deduped, 1..60 chars, at most 100. */
export function parseWords(raw: string): string[] {
  const out: string[] = [];
  for (const w of raw.split(/[,\n]/)) {
    const t = w.trim().toLowerCase();
    if (t && t.length <= 60 && !out.includes(t)) out.push(t);
  }
  return out.slice(0, MAX);
}

/** Sanitized list from the stored JSON (bad data = empty list). */
export function readWords(json: string | null | undefined): string[] {
  try {
    const j: unknown = JSON.parse(json ?? "[]");
    return Array.isArray(j) ? parseWords(j.filter((x) => typeof x === "string").join(",")) : [];
  } catch { return []; }
}

/** The first muted word found in `text` (case-insensitive substring), or null. */
export function spoilerHit(text: string, words: string[]): string | null {
  const t = text.toLowerCase();
  return words.find((w) => t.includes(w)) ?? null;
}
