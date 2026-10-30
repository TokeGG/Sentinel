// Clipboard history search for the Terminal home (and anything else):
// `searchClipboard("foo")` -> newest matching clips. Reads SQLite only.
import { getDb } from "../../core/db";
import { filterClips, type ClipRow } from "../../shell/extras/textTools";

export async function searchClipboard(q: string, limit = 20): Promise<ClipRow[]> {
  const d = await getDb();
  const rows = await d.select<ClipRow[]>("SELECT id, content, copied_at FROM clipboard_history ORDER BY copied_at DESC LIMIT 500");
  return filterClips(rows, q, limit);
}
