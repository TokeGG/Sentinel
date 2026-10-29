// SQLite side of the notes editor: notes + note_meta (folder/pin/archive), versions, card sync.
import { getDb, logActivity } from "../../core/db";
import type { NoteRow } from "./noteLogic";
import { dayStr, newCard, parseCards, syncPlan } from "./sm2";

export const KEEP_VERSIONS = 20;

export async function listAll(): Promise<NoteRow[]> {
  const d = await getDb();
  return d.select<NoteRow[]>(
    "SELECT n.id, n.body, n.tags, n.filed_to, n.created_at, m.folder, m.pinned, m.archived, m.updated_at FROM notes n LEFT JOIN note_meta m ON m.note_id = n.id ORDER BY n.id DESC LIMIT 2000"
  );
}

async function syncCards(id: number, body: string) {
  const d = await getDb();
  const have = await d.select<{ q: string; a: string }[]>("SELECT q, a FROM note_cards WHERE note_id = $1", [id]);
  const plan = syncPlan(have, parseCards(body));
  const due = newCard(new Date()).due;
  for (const c of plan.add) await d.execute("INSERT INTO note_cards (note_id, q, a, due) VALUES ($1,$2,$3,$4)", [id, c.q, c.a, due]);
  for (const c of plan.update) await d.execute("UPDATE note_cards SET a = $3 WHERE note_id = $1 AND q = $2", [id, c.q, c.a]);
  for (const q of plan.remove) await d.execute("DELETE FROM note_cards WHERE note_id = $1 AND q = $2", [id, q]);
}

const touch = "INSERT INTO note_meta (note_id, updated_at) VALUES ($1, datetime('now')) ON CONFLICT(note_id) DO UPDATE SET updated_at = datetime('now')";

export async function createNote(body: string, folder = "", tags = ""): Promise<number> {
  const d = await getDb();
  const r = await d.execute("INSERT INTO notes (body, tags, filed_to) VALUES ($1, $2, $3)", [body, tags || null, folder || "Notes"]);
  const id = Number(r.lastInsertId);
  await d.execute("INSERT INTO note_meta (note_id, folder) VALUES ($1, $2) ON CONFLICT(note_id) DO UPDATE SET folder = $2", [id, folder]);
  await syncCards(id, body);
  return id;
}

/** Saves the body; when it changed, the previous text is kept as a version (last KEEP_VERSIONS). */
export async function saveNote(id: number, body: string, tags: string): Promise<void> {
  const d = await getDb();
  const [old] = await d.select<{ body: string }[]>("SELECT body FROM notes WHERE id = $1", [id]);
  if (!old) throw new Error("note not found");
  if (old.body !== body) {
    await d.execute("INSERT INTO note_versions (note_id, body) VALUES ($1, $2)", [id, old.body]);
    await d.execute("DELETE FROM note_versions WHERE note_id = $1 AND id NOT IN (SELECT id FROM note_versions WHERE note_id = $1 ORDER BY id DESC LIMIT $2)", [id, KEEP_VERSIONS]);
  }
  await d.execute("UPDATE notes SET body = $1, tags = $2 WHERE id = $3", [body, tags.trim() || null, id]);
  await d.execute(touch, [id]);
  await syncCards(id, body);
}

export async function setMeta(id: number, patch: { folder?: string; pinned?: boolean; archived?: boolean }): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT INTO note_meta (note_id) VALUES ($1) ON CONFLICT(note_id) DO NOTHING", [id]);
  if (patch.folder !== undefined) await d.execute("UPDATE note_meta SET folder = $2 WHERE note_id = $1", [id, patch.folder.trim().replace(/^\/+|\/+$/g, "")]);
  if (patch.pinned !== undefined) await d.execute("UPDATE note_meta SET pinned = $2 WHERE note_id = $1", [id, patch.pinned ? 1 : 0]);
  if (patch.archived !== undefined) await d.execute("UPDATE note_meta SET archived = $2 WHERE note_id = $1", [id, patch.archived ? 1 : 0]);
}

export async function removeNote(id: number): Promise<void> {
  const d = await getDb();
  for (const t of ["note_meta", "note_versions", "note_files", "note_cards"]) await d.execute(`DELETE FROM ${t} WHERE note_id = $1`, [id]);
  await d.execute("DELETE FROM notes WHERE id = $1", [id]);
  await logActivity("notes", "delete_note", `deleted note #${id}`, "ok");
}

export const listVersions = async (id: number) =>
  (await getDb()).select<{ id: number; body: string; saved_at: string }[]>("SELECT id, body, saved_at FROM note_versions WHERE note_id = $1 ORDER BY id DESC", [id]);

export const today = () => dayStr(new Date());
