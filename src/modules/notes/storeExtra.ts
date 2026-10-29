// SQLite side of notes extras: templates, attachments, flashcards, snippets, vault.
import { getDb } from "../../core/db";
import type { Card } from "./sm2";

export type Tpl = { id: number; name: string; body: string };
export type Attachment = { id: number; note_id: number; name: string; mime: string; size: number };
export type CardRow = Card & { note_id: number; q: string; a: string };
export type Snippet = { id: number; title: string; body: string; tags: string };
export type VaultRow = { id: number; name: string; kind: string; text: string; tags: string; size: number; added_at: string };

export const MAX_ATTACH_BYTES = 512_000;

const all = async <T,>(sql: string, args: unknown[] = []) => (await getDb()).select<T[]>(sql, args);
const run = async (sql: string, args: unknown[]) => void (await (await getDb()).execute(sql, args));

export const listTemplates = () => all<Tpl>("SELECT * FROM note_templates ORDER BY name");
export const addTemplate = (name: string, body: string) => run("INSERT INTO note_templates (name, body) VALUES ($1,$2)", [name, body]);
export const deleteTemplate = (id: number) => run("DELETE FROM note_templates WHERE id = $1", [id]);

export const listAttachments = (noteId: number) => all<Attachment>("SELECT id, note_id, name, mime, size FROM note_files WHERE note_id = $1 ORDER BY id", [noteId]);
export const getAttachmentData = async (id: number) => (await all<{ data: string }>("SELECT data FROM note_files WHERE id = $1", [id]))[0]?.data ?? "";
export async function addAttachment(noteId: number, name: string, mime: string, size: number, data: string) {
  if (size > MAX_ATTACH_BYTES) throw new Error(`attachment over ${Math.round(MAX_ATTACH_BYTES / 1000)} KB`);
  await run("INSERT INTO note_files (note_id, name, mime, size, data) VALUES ($1,$2,$3,$4,$5)", [noteId, name, mime, size, data]);
}
export const deleteAttachment = (id: number) => run("DELETE FROM note_files WHERE id = $1", [id]);

export const listCards = () => all<CardRow>("SELECT note_id, q, a, ease, interval, reps, due FROM note_cards ORDER BY due");
export const saveCard = (c: CardRow) => run("UPDATE note_cards SET ease=$3, interval=$4, reps=$5, due=$6 WHERE note_id=$1 AND q=$2", [c.note_id, c.q, c.ease, c.interval, c.reps, c.due]);

export const listSnippets = () => all<Snippet>("SELECT * FROM snippets ORDER BY title");
export const addSnippet = (title: string, body: string, tags: string) => run("INSERT INTO snippets (title, body, tags) VALUES ($1,$2,$3)", [title, body, tags]);
export const deleteSnippet = (id: number) => run("DELETE FROM snippets WHERE id = $1", [id]);

export const listVault = () => all<VaultRow>("SELECT id, name, kind, text, tags, size, added_at FROM vault_docs ORDER BY id DESC");
export const addVault = (name: string, kind: string, text: string, size: number, data: string) =>
  run("INSERT INTO vault_docs (name, kind, text, size, data) VALUES ($1,$2,$3,$4,$5)", [name, kind, text, size, data]);
export const tagVault = (id: number, tags: string) => run("UPDATE vault_docs SET tags = $2 WHERE id = $1", [id, tags]);
export const deleteVault = (id: number) => run("DELETE FROM vault_docs WHERE id = $1", [id]);
