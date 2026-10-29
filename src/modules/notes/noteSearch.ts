// Full-text search over notes held in memory (LIKE-style, no FTS table needed) with highlight segments.
import { noteTitle, parseTags, type NoteRow } from "./noteLogic.ts";

const terms = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const count = (hay: string, t: string) => hay.split(t).length - 1;

export type Hit = { note: NoteRow; score: number; snippet: string };

/** Every term must appear; title hits weigh 5, tags 3, body 1 (max 5 per term). */
export function searchNotes(notes: NoteRow[], q: string): Hit[] {
  const ts = terms(q);
  if (!ts.length) return [];
  const hits: Hit[] = [];
  for (const note of notes) {
    const title = noteTitle(note.body).toLowerCase();
    const body = note.body.toLowerCase();
    const tags = parseTags(note.tags).join(" ");
    let score = 0;
    let ok = true;
    for (const t of ts) {
      const b = Math.min(5, count(body, t));
      const s = (title.includes(t) ? 5 : 0) + (tags.includes(t) ? 3 : 0) + b;
      if (!s) { ok = false; break; }
      score += s;
    }
    if (ok) hits.push({ note, score, snippet: snippetAround(note.body, ts[0]) });
  }
  return hits.sort((a, b) => b.score - a.score || b.note.id - a.note.id);
}

export function snippetAround(body: string, term: string, radius = 50): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const i = flat.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return flat.slice(0, radius * 2);
  const a = Math.max(0, i - radius);
  return `${a > 0 ? "…" : ""}${flat.slice(a, i + term.length + radius)}${i + term.length + radius < flat.length ? "…" : ""}`;
}

export type Seg = { text: string; hit: boolean };

/** Splits text into plain and matched parts (render matches in <mark>; no HTML involved). */
export function highlight(text: string, q: string): Seg[] {
  const ts = terms(q).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!ts.length || !text) return [{ text, hit: false }];
  return text.split(new RegExp(`(${ts.join("|")})`, "i")).filter(Boolean).map((p, i) => ({ text: p, hit: i % 2 === 1 }));
}
