// Pure SQL builders for the memory viewer and the run log used by stats / cost (existing tables, no migration).
import type { Q } from "./sql.ts";

export const updateNote = (id: number, title: string, text: string): Q => ({ sql: "UPDATE bot_notes SET title = $2, text = $3 WHERE id = $1", params: [id, title, text] });
export const clearNotes = (): Q => ({ sql: "DELETE FROM bot_notes", params: [] });
export const clearSiteNotes = (): Q => ({ sql: "DELETE FROM bot_site_notes", params: [] });
export const episodeLog = (limit = 300): Q => ({ sql: "SELECT id, json, thumbs FROM bot_episodes ORDER BY id DESC LIMIT $1", params: [Math.max(1, Math.min(500, Math.floor(limit)))] });
