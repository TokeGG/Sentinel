// Pure helpers for the Backup panel. The module keeps no history beyond the
// current session's list, so "when" comes from the backup folder's own name
// (`sentinel-backup-<epoch seconds>`, written by the Rust command).
import { ago } from "../../ui/kit/format.ts";

type Row = Record<string, unknown>;

/** Section declarations; Panel renders exactly these ids. */
export const backupSections = [
  { id: "health", label: "Backup health" },
  { id: "last", label: "Last backup" },
  { id: "snapshots", label: "Snapshots" },
  { id: "restore", label: "Restore" },
  { id: "notice", label: "Restart notice" },
];

/** Time encoded in a backup folder path, or null if the name has no stamp. */
export function stampOf(path: string): Date | null {
  const m = /sentinel-backup-(\d{1,12})(?!\d)/.exec(String(path ?? ""));
  if (!m) return null;
  const d = new Date(Number(m[1]) * 1000);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** "just now", "5m ago", "3h ago", "3d ago", then a UTC date after a week. */
export function whenText(date: Date | null, now: Date = new Date()): string {
  if (!date || !Number.isFinite(date.getTime())) return "unknown time";
  const a = ago(date, now);
  if (a === "just now") return a;
  if (/d$/.test(a) && parseInt(a, 10) >= 7) return date.toISOString().slice(0, 10);
  return `${a} ago`;
}

/** Last path segment (either separator, trailing slashes ignored). */
export function folderName(path: string): string {
  const parts = String(path ?? "").split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export type Snapshot = { path: string; name: string; when: Date | null };

/** Known snapshots from load() rows (id = backup folder), newest first. */
export function snapshotsOf(rows: Row[]): Snapshot[] {
  return rows
    .map((r) => String(r.id ?? ""))
    .filter((p) => p !== "")
    .map((path) => ({ path, name: folderName(path), when: stampOf(path) }))
    .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0));
}
