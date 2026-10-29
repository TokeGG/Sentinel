// Markdown export of notes (written through write_text_file after a preview).
import { noteTitle, parseTags, type NoteRow } from "./noteLogic.ts";

export function noteMarkdown(n: NoteRow): string {
  const tags = parseTags(n.tags);
  const head = ["---", `created: ${n.created_at}`, ...(n.folder ? [`folder: ${n.folder}`] : []), ...(tags.length ? [`tags: [${tags.join(", ")}]`] : []), "---"];
  return `${head.join("\n")}\n\n${n.body.trimEnd()}\n`;
}

export const allMarkdown = (notes: NoteRow[]) => notes.map(noteMarkdown).join("\n\n");

export const safeFileName = (title: string) => (title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "note") + ".md";
export const exportName = (n: NoteRow) => safeFileName(noteTitle(n.body));
