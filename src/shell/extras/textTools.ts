// Pure text helpers: clipboard history filtering, snippet expansion
// (";sig" -> body), and Markdown export of any module's load() rows.
export type ClipRow = { id: string | number; content: string; copied_at?: string };

/** Case-insensitive, all words must match; newest first as given. */
export function filterClips<T extends ClipRow>(rows: T[], q: string, limit = 20): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => { const t = r.content.toLowerCase(); return words.every((w) => t.includes(w)); }).slice(0, limit);
}

export type Snip = { title: string; body: string };
/** Trigger = prefix + snippet title without spaces, lower-case (";" + "My sig" -> ";mysig"). */
export const triggerOf = (title: string, prefix = ";"): string => prefix + title.toLowerCase().replace(/\s+/g, "");
/** If text (up to the caret) ends with a trigger, return the expanded text and new caret. */
export function expandAt(text: string, caret: number, snips: Snip[], prefix = ";"): { text: string; caret: number } | null {
  const before = text.slice(0, caret);
  const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\w-]+$`).exec(before);
  if (!m) return null;
  const s = snips.find((x) => triggerOf(x.title, prefix) === m[0].toLowerCase());
  if (!s) return null;
  const start = caret - m[0].length;
  return { text: text.slice(0, start) + s.body + text.slice(caret), caret: start + s.body.length };
}

const cell = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
/** Rows -> Markdown: a bullet list when rows have title/link, else a table of the first 8 columns. */
export function rowsToMarkdown(name: string, rows: Record<string, unknown>[]): string {
  const head = `# ${name}\n\n`;
  if (!rows.length) return `${head}_No rows._\n`;
  if (rows.every((r) => typeof r.title === "string")) {
    return head + rows.map((r) => `- ${typeof r.link === "string" && /^https?:/.test(r.link) ? `[${cell(r.title)}](${r.link})` : cell(r.title)}`).join("\n") + "\n";
  }
  const cols = [...new Set(rows.flatMap(Object.keys))].slice(0, 8);
  return head + `| ${cols.join(" | ")} |\n| ${cols.map(() => "---").join(" | ")} |\n` + rows.map((r) => `| ${cols.map((c) => cell(r[c])).join(" | ")} |`).join("\n") + "\n";
}
