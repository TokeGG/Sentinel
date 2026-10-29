// "Feed it" notes: text (or already-fetched page text) split into snippets, BM25 retrieval of the top-k for the
// prompt. Pure: fetching a URL is the caller's job (part 2), this only turns the fetched HTML/text into a note.
export interface Note { id?: number; title: string; source: string; text: string }
export interface Snippet { noteId: number | undefined; title: string; text: string; score: number }

export const MAX_NOTE_CHARS = 50_000;
const STOP = new Set("the a an and or of to in on for with is are was be it this that at by from as".split(" "));

export const tokenize = (s: string): string[] => (s.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []).filter((w) => !STOP.has(w));

/** Crude but safe HTML -> text for fetched pages: drops script/style, tags, entities. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

export type NoteCheck = { ok: true; note: Note } | { ok: false; error: string };
/** A note from pasted text, or from a URL plus its fetched text (http(s) only; the text is trimmed and capped). */
export function makeNote(title: string, text: string, source = "text"): NoteCheck {
  const t = text.trim().slice(0, MAX_NOTE_CHARS);
  if (!t) return { ok: false, error: "empty note" };
  if (source !== "text") {
    try { if (!/^https?:$/.test(new URL(source).protocol)) throw new Error(); } catch { return { ok: false, error: "source must be text or an http(s) URL" }; }
  }
  return { ok: true, note: { title: title.trim().slice(0, 120) || source.slice(0, 120), source, text: t } };
}

/** Paragraph-based chunks of at most `max` characters (a long paragraph is cut on sentence or space boundaries). */
export function chunkText(text: string, max = 500): string[] {
  const out: string[] = [];
  let cur = "";
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (const para of text.split(/\n{1,}/)) {
    let p = para.trim();
    while (p.length > max) {
      const cut = Math.max(p.lastIndexOf(". ", max), p.lastIndexOf(" ", max), max > 50 ? 0 : max);
      flush();
      out.push(p.slice(0, cut > 0 ? cut + 1 : max).trim());
      p = p.slice(cut > 0 ? cut + 1 : max).trim();
    }
    if (cur && cur.length + p.length + 1 > max) flush();
    cur = cur ? `${cur} ${p}` : p;
  }
  flush();
  return out.filter(Boolean);
}

/** BM25 over every note's chunks; best `k` with a positive score, best first. */
export function retrieve(notes: Note[], query: string, k = 4): Snippet[] {
  const docs = notes.flatMap((n) => chunkText(n.text).map((text) => ({ n, text, toks: tokenize(`${n.title} ${text}`) })));
  const q = [...new Set(tokenize(query))];
  if (!docs.length || !q.length || k <= 0) return [];
  const avg = docs.reduce((s, d) => s + d.toks.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d.toks)) df.set(w, (df.get(w) ?? 0) + 1);
  const K1 = 1.5, B = 0.75;
  return docs
    .map((d) => {
      const tf = new Map<string, number>();
      for (const w of d.toks) tf.set(w, (tf.get(w) ?? 0) + 1);
      let score = 0;
      for (const w of q) {
        const f = tf.get(w) ?? 0;
        if (!f) continue;
        const idf = Math.log(1 + (docs.length - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
        score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.toks.length) / avg)));
      }
      return { noteId: d.n.id, title: d.n.title, text: d.text, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Prompt lines for the retrieved snippets. */
export const noteLines = (snips: Snippet[]): string[] => snips.map((s) => `${s.title}: ${s.text}`);
