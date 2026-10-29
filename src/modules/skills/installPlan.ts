// Pure: turns a GitHub git-tree listing into the file list an install would
// write (size-capped, text only, path-sanitised), and diffs two such lists.
import { cleanRel } from "./paths.ts";

export const LIMITS = { files: 60, file: 256 * 1024, total: 2 * 1024 * 1024 };
export interface TreeEntry { path: string; type: string; size?: number; sha: string }
export interface PlanFile { path: string; size: number; sha: string }
export interface FilePlan { files: PlanFile[]; skipped: { path: string; reason: string }[]; error?: string }

const TEXT_EXT = new Set(["md", "markdown", "txt", "json", "yaml", "yml", "toml", "js", "mjs", "cjs", "ts", "py", "sh", "csv", "html", "css", "cfg", "ini"]);
const TEXT_NAMES = new Set(["license", "readme", "notice", "requirements", "makefile"]);
const SKIP_SEG = new Set(["node_modules", "__pycache__", "dist", "build", "venv"]);
const LOCKFILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "uv.lock", "poetry.lock", "bun.lockb"]);

const isText = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? TEXT_EXT.has(name.slice(dot + 1).toLowerCase()) : TEXT_NAMES.has(name.toLowerCase());
};

/** `subdir` ("" = root) is stripped from every returned path. */
export function planFiles(tree: TreeEntry[], subdir: string): FilePlan {
  const prefix = subdir ? `${subdir}/` : "";
  const files: PlanFile[] = [];
  const skipped: FilePlan["skipped"] = [];
  let total = 0;
  for (const e of tree) {
    if (e.type !== "blob" || !e.path.startsWith(prefix)) continue;
    const rel = e.path.slice(prefix.length);
    const name = rel.split("/").pop() ?? "";
    const segs = rel.split("/");
    const why =
      cleanRel(rel) === null ? "unsafe path"
      : segs.some((s) => s.startsWith(".") || SKIP_SEG.has(s)) ? "hidden or build directory"
      : LOCKFILES.has(name) ? "lockfile"
      : !isText(name) ? "not a text file"
      : (e.size ?? 0) > LIMITS.file ? "too large"
      : "";
    if (why) {
      skipped.push({ path: rel, reason: why });
      continue;
    }
    files.push({ path: rel, size: e.size ?? 0, sha: e.sha });
    total += e.size ?? 0;
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const error =
    files.length === 0 ? "no installable files found at that location"
    : files.length > LIMITS.files ? `${files.length} files exceeds the ${LIMITS.files}-file limit; point at a sub-directory`
    : total > LIMITS.total ? "files exceed the total size limit; point at a sub-directory"
    : undefined;
  return { files, skipped, error };
}

export interface FileDiff { added: string[]; removed: string[]; changed: string[] }
export function diffFiles(oldF: PlanFile[], newF: PlanFile[]): FileDiff {
  const o = new Map(oldF.map((f) => [f.path, f.sha]));
  const n = new Map(newF.map((f) => [f.path, f.sha]));
  return {
    added: [...n.keys()].filter((p) => !o.has(p)),
    removed: [...o.keys()].filter((p) => !n.has(p)),
    changed: [...n.keys()].filter((p) => o.has(p) && o.get(p) !== n.get(p)),
  };
}
export const diffEmpty = (d: FileDiff) => !d.added.length && !d.removed.length && !d.changed.length;
export const diffSummary = (d: FileDiff) => `${d.added.length} added, ${d.changed.length} changed, ${d.removed.length} removed`;
