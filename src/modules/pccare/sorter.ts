// Pure planners for the download sorter and screenshot organizer. Output = moves the user previews;
// Rust apply_moves re-checks each one (direct child, safe folder name, no overwrite).
export interface DirFile { name: string; size: number; modified: number }
export interface Move { from: string; folder: string; name: string }

export const DEFAULT_RULES: Record<string, string[]> = {
  Documents: ["pdf", "doc", "docx", "txt", "md", "rtf", "odt", "xls", "xlsx", "csv", "ppt", "pptx"],
  Images: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"],
  Video: ["mp4", "mkv", "mov", "avi", "webm"],
  Audio: ["mp3", "wav", "flac", "ogg", "m4a"],
  Archives: ["zip", "rar", "7z", "tar", "gz"],
  Installers: ["exe", "msi", "msix"],
};

export const ext = (name: string) => (/\.([^.]+)$/.exec(name)?.[1] ?? "").toLowerCase();
const join = (dir: string, name: string) => `${dir.replace(/[\\/]+$/, "")}${dir.includes("\\") ? "\\" : "/"}${name}`;

/** Files whose extension matches a rule -> move into that rule's folder. Partial downloads are skipped. */
export function planSort(dir: string, files: DirFile[], rules = DEFAULT_RULES): Move[] {
  const byExt = new Map<string, string>();
  for (const [folder, exts] of Object.entries(rules)) exts.forEach((e) => byExt.set(e.toLowerCase(), folder));
  return files
    .filter((f) => !/\.(crdownload|part|tmp)$/i.test(f.name))
    .flatMap((f) => { const folder = byExt.get(ext(f.name)); return folder ? [{ from: join(dir, f.name), folder, name: f.name }] : []; });
}

const IMG = new Set(["png", "jpg", "jpeg", "webp", "bmp", "gif"]);
const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM" in local time from unix seconds. */
export function monthOf(secs: number): string {
  const d = new Date(secs * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Screenshots grouped by month (newest first) for the list view. */
export function groupByMonth(files: DirFile[]): { month: string; files: DirFile[] }[] {
  const m = new Map<string, DirFile[]>();
  for (const f of files.filter((f) => IMG.has(ext(f.name)))) {
    const k = monthOf(f.modified);
    m.set(k, [...(m.get(k) ?? []), f]);
  }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, files]) => ({ month, files }));
}

/** Move each image into YYYY-MM; with rename, name = "Screenshot YYYY-MM-DD HHMMSS.ext" (unique per plan). */
export function planScreenshots(dir: string, files: DirFile[], rename: boolean): Move[] {
  const used = new Set<string>();
  return files.filter((f) => IMG.has(ext(f.name))).map((f) => {
    const d = new Date(f.modified * 1000);
    let name = f.name;
    if (rename) {
      const base = `Screenshot ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      name = `${base}.${ext(f.name)}`;
      for (let i = 2; used.has(name); i++) name = `${base} (${i}).${ext(f.name)}`;
    }
    used.add(name);
    return { from: join(dir, f.name), folder: monthOf(f.modified), name };
  });
}
