// Folder roles, ordering and display names. Pure.
import type { Folder, Role } from "./types.ts";

const SPECIAL: Record<string, Role> = { "\\sent": "sent", "\\drafts": "drafts", "\\trash": "trash", "\\junk": "junk", "\\archive": "archive", "\\all": "archive" };
const NAMES: [RegExp, Role][] = [
  [/^inbox$/i, "inbox"], [/(^|[/.])(sent( items| mail| messages)?|gesendet)$/i, "sent"], [/(^|[/.])drafts?$/i, "drafts"],
  [/(^|[/.])(trash|deleted( items| messages)?|bin)$/i, "trash"], [/(^|[/.])(junk( e-?mail)?|spam)$/i, "junk"], [/(^|[/.])archive$/i, "archive"],
];

/** Role from IMAP special-use attributes first, then conventional names. */
export function folderRole(name: string, attrs: string[] = []): Role {
  for (const a of attrs) if (SPECIAL[a.toLowerCase()]) return SPECIAL[a.toLowerCase()];
  return NAMES.find(([re]) => re.test(name))?.[1] ?? "other";
}

const ORDER: Role[] = ["inbox", "sent", "drafts", "trash", "junk", "archive", "other"];
export function sortFolders(fs: Folder[]): Folder[] {
  return [...fs].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
}
export const folderOfRole = (fs: Folder[], r: Role) => fs.find((f) => f.role === r)?.name ?? null;

/** IMAP modified UTF-7 (RFC 3501 5.1.3) -> display text. Bad input is returned unchanged. */
export function decodeFolderName(s: string): string {
  try {
    return s.replace(/&([^-]*)-/g, (_, b64: string) => {
      if (!b64) return "&";
      const bin = atob(b64.replace(/,/g, "/") + "===".slice((b64.length + 3) % 4));
      let out = "";
      for (let i = 0; i + 1 < bin.length; i += 2) out += String.fromCharCode((bin.charCodeAt(i) << 8) | bin.charCodeAt(i + 1));
      return out;
    });
  } catch { return s; }
}
export const folderLabel = (f: Folder) => (f.role === "inbox" ? "Inbox" : decodeFolderName(f.name.split(/[/.]/).pop() ?? f.name));
