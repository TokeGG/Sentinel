// Pure helpers for the Clipboard & Quick-Launch panel. Clipboard text is
// sensitive: nothing here logs or transmits it.
type Row = Record<string, unknown>;

/** Section declarations; Panel renders exactly these ids. */
export const clipboardSections = [
  { id: "launcher", label: "Quick-launch" },
  { id: "history", label: "Clipboard history" },
  { id: "status", label: "Auto-check" },
];

/** One-line preview: whitespace collapsed, cut to `max` characters with an ellipsis. */
export function previewText(text: string, max: number): string {
  if (typeof text !== "string" || max <= 0) return "";
  const one = text.slice(0, max * 4 + 16).replace(/\s+/g, " ").trim();
  return one.length <= max ? one : max === 1 ? "…" : `${one.slice(0, max - 1).trimEnd()}…`;
}

export type LaunchKind = "app" | "folder" | "file";
const APP_EXT = new Set(["exe", "lnk", "bat", "cmd", "msi", "com", "app"]);

export function kindFor(path: string): LaunchKind {
  const p = String(path ?? "");
  if (/[\\/]$/.test(p)) return "folder";
  const name = p.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return name === "" ? "file" : "folder";
  return APP_EXT.has(name.slice(dot + 1).toLowerCase()) ? "app" : "file";
}

const GLYPHS: Record<LaunchKind, string> = { app: "▶", folder: "▣", file: "▤" };
export const glyphFor = (path: string): string => GLYPHS[kindFor(path)];

export type Launcher = { id: string; label: string; path: string; glyph: string };
export type Clip = { id: string; text: string; copiedAt: string };

/** Splits load() rows (ids `launch-N` / `clip-N`) into launchers and clips (newest first as loaded). */
export function splitRows(rows: Row[]): { launch: Launcher[]; clips: Clip[] } {
  const launch: Launcher[] = [];
  const clips: Clip[] = [];
  for (const r of rows) {
    const id = String(r.id ?? "");
    if (id.startsWith("launch-")) {
      const path = String(r.path ?? "");
      const label = String(r.label ?? String(r.title ?? "").replace(/^▶\s*/, "")) || path;
      launch.push({ id, label, path, glyph: glyphFor(path) });
    } else if (id.startsWith("clip-")) {
      clips.push({ id, text: String(r.title ?? ""), copiedAt: String(r.copied_at ?? "") });
    }
  }
  return { launch, clips };
}

/** Drops a clip identical to the one right before it. */
export function dedupeConsecutive<T extends { text: string }>(clips: T[]): T[] {
  return clips.filter((c, i) => i === 0 || c.text !== clips[i - 1].text);
}
