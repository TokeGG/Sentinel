// Per-category knowledge base for panel bots: notes, worked examples and saved Q&A (kb_entries, migration 45).
// Pure: validation, SQL builders and BM25 retrieval (reuses the bot's retrieve()). store.ts runs the SQL.
import { retrieve, type Note, type Snippet } from "../../modules/bot/knowledge.ts";
import { isCategory, type Category } from "../categories.ts";

export const KB_KINDS = ["note", "example", "qa"] as const;
export type KbKind = (typeof KB_KINDS)[number];
export interface KbEntry { id?: number; category: Category; kind: KbKind; title: string; body: string; created_at?: string }
export interface Q { sql: string; params: unknown[] }

export const MAX_BODY = 8000;
export const MAX_PER_CATEGORY = 2000;

export type KbCheck = { ok: true; entry: KbEntry } | { ok: false; error: string };
export function makeEntry(category: unknown, kind: unknown, title: string, body: string): KbCheck {
  if (!isCategory(category)) return { ok: false, error: "unknown category" };
  if (!(KB_KINDS as readonly unknown[]).includes(kind)) return { ok: false, error: "kind must be note, example or qa" };
  const b = String(body ?? "").trim().slice(0, MAX_BODY);
  if (!b) return { ok: false, error: "empty entry" };
  const t = String(title ?? "").trim().slice(0, 120) || b.slice(0, 60);
  return { ok: true, entry: { category, kind: kind as KbKind, title: t, body: b } };
}

/** A thumbs-up answer becomes an `example` (question -> answer) so the next prompt can imitate it. */
export function exampleFromAnswer(category: Category, question: string, answer: string): KbCheck {
  return makeEntry(category, "example", question.slice(0, 120), `Q: ${question.trim()}\nA: ${answer.trim()}`);
}
/** A thumbs-down answer is kept as a `qa` note telling the model what not to do again. */
export function lessonFromBadAnswer(category: Category, question: string, answer: string): KbCheck {
  return makeEntry(category, "qa", `Avoid: ${question.slice(0, 100)}`, `The user marked this answer as unhelpful. Question: ${question.trim()}\nBad answer (do not repeat): ${answer.trim().slice(0, 600)}`);
}

export const insertEntry = (e: KbEntry): Q => ({ sql: "INSERT INTO kb_entries (category, kind, title, body) VALUES ($1,$2,$3,$4)", params: [e.category, e.kind, e.title, e.body] });
export const deleteEntry = (id: number): Q => ({ sql: "DELETE FROM kb_entries WHERE id = $1", params: [id] });
export const listEntries = (category: Category): Q => ({ sql: "SELECT id, category, kind, title, body, created_at FROM kb_entries WHERE category = $1 ORDER BY id DESC LIMIT $2", params: [category, MAX_PER_CATEGORY] });
export const pruneCategory = (category: Category): Q => ({ sql: "DELETE FROM kb_entries WHERE category = $1 AND id NOT IN (SELECT id FROM kb_entries WHERE category = $1 ORDER BY id DESC LIMIT $2)", params: [category, MAX_PER_CATEGORY] });

/** Rows from SQLite: anything malformed is dropped. */
export function readEntries(rows: unknown[]): KbEntry[] {
  return rows.flatMap((r) => {
    const o = r as Record<string, unknown>;
    const c = makeEntry(o?.category, o?.kind, String(o?.title ?? ""), String(o?.body ?? ""));
    return c.ok ? [{ ...c.entry, id: Number(o.id), created_at: String(o.created_at ?? "") }] : [];
  });
}

/** Best `k` snippets for a question (BM25 over the category's entries). */
export function retrieveKb(entries: KbEntry[], question: string, k = 4): Snippet[] {
  const notes: Note[] = entries.map((e) => ({ id: e.id, title: `${e.kind}: ${e.title}`, source: "text", text: e.body }));
  return retrieve(notes, question, k);
}
