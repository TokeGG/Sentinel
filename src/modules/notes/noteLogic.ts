// Pure note helpers: titles, tags, [[wikilinks]], backlinks, folders, list filtering.
export type NoteRow = {
  id: number; body: string; tags: string | null; filed_to: string | null; created_at: string;
  folder?: string | null; pinned?: number | null; archived?: number | null; updated_at?: string | null;
};

export function noteTitle(body: string): string {
  const line = String(body ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const t = line.replace(/^#+\s*/, "").replace(/\[\[|\]\]/g, "").trim();
  return t ? (t.length > 60 ? `${t.slice(0, 59)}…` : t) : "Untitled";
}

export function parseTags(s: string | null | undefined): string[] {
  return [...new Set(String(s ?? "").split(/[,\s]+/).map((t) => t.replace(/^#/, "").toLowerCase()).filter(Boolean))];
}

export function wikiLinks(body: string): string[] {
  return [...new Set([...String(body ?? "").matchAll(/\[\[([^\]\n]+)\]\]/g)].map((m) => m[1].trim()).filter(Boolean))];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The note a [[name]] points at (by title, case-insensitive); null if none. */
export const resolveLink = (notes: NoteRow[], name: string): NoteRow | null => notes.find((n) => same(noteTitle(n.body), name)) ?? null;

export function backlinks(notes: NoteRow[], id: number): NoteRow[] {
  const me = notes.find((n) => n.id === id);
  if (!me) return [];
  const t = noteTitle(me.body);
  return notes.filter((n) => n.id !== id && wikiLinks(n.body).some((l) => same(l, t)));
}

export type FolderNode = { name: string; path: string; count: number; children: FolderNode[] };

/** Nested folder tree from "A/B" paths; count includes subfolders. */
export function folderTree(paths: string[]): FolderNode[] {
  const root: FolderNode = { name: "", path: "", count: 0, children: [] };
  for (const p of paths) {
    let at = root;
    let acc = "";
    for (const part of p.split("/").map((x) => x.trim()).filter(Boolean)) {
      acc = acc ? `${acc}/${part}` : part;
      let c = at.children.find((x) => x.name === part);
      if (!c) at.children.push((c = { name: part, path: acc, count: 0, children: [] }));
      c.count++;
      at = c;
    }
  }
  const sort = (n: FolderNode) => (n.children.sort((a, b) => a.name.localeCompare(b.name)), n.children.forEach(sort));
  sort(root);
  return root.children;
}

export const inFolder = (n: NoteRow, path: string) => !path || (n.folder ?? "") === path || (n.folder ?? "").startsWith(`${path}/`);

export type ListOpts = { folder?: string; tag?: string; archived?: boolean };

/** Pinned first, then newest edit. Archived notes only when asked for. */
export function listNotes(notes: NoteRow[], o: ListOpts = {}): NoteRow[] {
  const stamp = (n: NoteRow) => n.updated_at || n.created_at;
  return notes
    .filter((n) => !!n.archived === !!o.archived && inFolder(n, o.folder ?? "") && (!o.tag || parseTags(n.tags).includes(o.tag)))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || stamp(b).localeCompare(stamp(a)));
}

export function tagCounts(notes: NoteRow[]): [string, number][] {
  const m = new Map<string, number>();
  for (const n of notes) for (const t of parseTags(n.tags)) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const tagFilter = <T extends { tags: string }>(items: T[], tag: string) => (tag ? items.filter((i) => parseTags(i.tags).includes(tag)) : items);
