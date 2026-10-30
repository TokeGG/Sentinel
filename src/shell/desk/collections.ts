// Pure smart folders (named saved searches over core/search) and panel groups
// (named panel id sets that open together). Stored as JSON in app_settings
// `smart_folders` ({name: query}) and `panel_groups` ({name: id[]}).
import { cleanName } from "./namedLayouts.ts";

export type SmartFolders = Record<string, string>;
export type Groups = Record<string, string[]>;

export function sanitizeFolders(raw: unknown): SmartFolders {
  const out: SmartFolders = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = cleanName(k);
    if (n && typeof v === "string" && v.trim()) out[n] = v.trim().slice(0, 200);
  }
  return out;
}
export function sanitizeGroups(raw: unknown): Groups {
  const out: Groups = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = cleanName(k);
    if (!n || !Array.isArray(v)) continue;
    const ids = [...new Set(v.filter((x): x is string => typeof x === "string" && /^[\w.\-]{1,64}$/.test(x)))];
    if (ids.length) out[n] = ids;
  }
  return out;
}
/** Parse "a, b c" into a clean id list. */
export const parseIds = (s: string): string[] => [...new Set(s.split(/[\s,]+/).filter((x) => /^[\w.\-]{1,64}$/.test(x)))];

/** Terminal text "folder <name>" / "group <name>" -> command, case-insensitive name match. */
export function resolveNamed(text: string, folders: SmartFolders, groups: Groups): { kind: "folder" | "group"; name: string } | null {
  const m = /^(folder|group)\s+(.+)$/i.exec(text.trim());
  if (!m) return null;
  const pool = m[1].toLowerCase() === "folder" ? folders : groups;
  const name = Object.keys(pool).find((n) => n.toLowerCase() === m[2].trim().toLowerCase());
  return name ? { kind: m[1].toLowerCase() as "folder" | "group", name } : null;
}

/** Alt+Q: the most recent other panel that is still open. */
export function quickSwitchTarget(back: string[], isOpen: (id: string) => boolean): string | null {
  for (let i = back.length - 1; i >= 0; i--) if (isOpen(back[i])) return back[i];
  return null;
}
