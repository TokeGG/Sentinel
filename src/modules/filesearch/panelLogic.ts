// Pure helpers for the File Search panel.
type Row = Record<string, unknown>;

/** Section declarations; Panel renders exactly these ids. */
export const filesearchSections = [
  { id: "search", label: "Search" },
  { id: "roots", label: "Folders" },
  { id: "results", label: "Results" },
];

export const DEBOUNCE_MS = 250;
export const MIN_QUERY = 2;
/** Max rows put in the DOM (the Rust search itself caps at 500 per folder). */
export const SHOW_MAX = 200;

export const shouldSearch = (q: string): boolean => typeof q === "string" && q.trim().length >= MIN_QUERY;

const SEP = /[\\/]/;
export function nameOf(path: string): string {
  const parts = String(path ?? "").split(SEP).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
export function folderOf(path: string): string {
  const p = String(path ?? "").replace(/[\\/]+$/, "");
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i < 0 ? "" : i === 0 ? p[0] : p.slice(0, i);
}

function middle(s: string, n: number): string {
  if (n <= 0) return "";
  if (s.length <= n) return s;
  if (n === 1) return "…";
  const keep = n - 1;
  const left = Math.ceil(keep / 2);
  return `${s.slice(0, left)}…${s.slice(s.length - (keep - left))}`;
}

/** Keeps the drive/UNC share and the file name, middle-ellipsis in between; never longer than max. */
export function shortPath(path: string, max: number): string {
  const p = String(path ?? "");
  if (p.length <= max) return p;
  const sep = p.includes("\\") ? "\\" : "/";
  const parts = p.split(SEP);
  const unc = /^[\\]{2}[^\\]/.test(p) && parts.length > 4;
  const head = unc ? `${sep}${sep}${parts[2]}${sep}${parts[3]}` : parts[0];
  const name = parts[parts.length - 1] || nameOf(p);
  const skipped = parts.length - (unc ? 5 : 2) > 0;
  const prefix = `${head}${sep}${skipped ? `…${sep}` : ""}`;
  const room = max - prefix.length;
  if (room < 4 || name === "") return middle(p, max);
  return prefix + middle(name, room);
}

/** Saved search folders (rows tagged kind "root"). */
export const rootsOf = (rows: Row[]): string[] =>
  rows.filter((r) => r.kind === "root").map((r) => String(r.path ?? "")).filter(Boolean);

/** Match rows (kind "result"); the skill returns only paths. */
export function resultsOf(rows: Row[]): { id: string; path: string; name: string; folder: string }[] {
  return rows
    .filter((r) => r.kind === "result" && String(r.path ?? "") !== "")
    .map((r) => {
      const path = String(r.path);
      return { id: String(r.id), path, name: nameOf(path), folder: folderOf(path) };
    });
}

/** Name split around the first case-insensitive match of `q` (for highlighting); no match -> whole name first. */
export function splitMatch(name: string, q: string): [string, string, string] {
  const needle = String(q ?? "").trim().toLowerCase();
  const i = needle ? name.toLowerCase().indexOf(needle) : -1;
  return i < 0 ? [name, "", ""] : [name.slice(0, i), name.slice(i, i + needle.length), name.slice(i + needle.length)];
}

/** Upper-case file extension for the result badge ("report.final.pdf" -> "PDF"); "" for none or a dotfile. */
export function extOf(name: string): string {
  const i = String(name ?? "").lastIndexOf(".");
  return i <= 0 || i === name.length - 1 ? "" : name.slice(i + 1, i + 5).toUpperCase();
}
