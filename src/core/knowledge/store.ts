// SQLite side of the per-category knowledge base (kbLogic.ts builds the SQL).
import { getDb } from "../db";
import type { Category } from "../categories";
import { deleteEntry, insertEntry, listEntries, pruneCategory, readEntries, type KbEntry, type Q } from "./kbLogic";

const run = async (q: Q) => (await getDb()).execute(q.sql, q.params);

export async function loadKb(category: Category): Promise<KbEntry[]> {
  const q = listEntries(category);
  return readEntries(await (await getDb()).select<unknown[]>(q.sql, q.params));
}
export async function addKb(e: KbEntry): Promise<void> {
  await run(insertEntry(e));
  await run(pruneCategory(e.category));
}
export const removeKb = (id: number) => run(deleteEntry(id)).then(() => undefined);
