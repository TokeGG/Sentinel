// Pure path hygiene for files that will be written under the app skills dir.
// Mirrors clean_rel() in src-tauri/src/commands/skills_fs.rs (Rust re-checks).
const RESERVED = new Set(["con", "prn", "aux", "nul", "com1", "com2", "lpt1", "lpt2"]);

/** Normalised '/'-relative path, or null for anything that could escape or is not portable. */
export function cleanRel(p: unknown): string | null {
  if (typeof p !== "string" || p.length === 0 || p.length > 240) return null;
  const segs = p.split("/");
  for (const s of segs) {
    if (s === "" || s === "." || s === ".." || /[. ]$/.test(s)) return null;
    if (RESERVED.has(s.split(".")[0].toLowerCase())) return null;
    if (/[\\:*?"<>|\u0000-\u001f\u007f]/.test(s)) return null;
  }
  return segs.join("/");
}

/** Lower-case id usable as a directory name: owner-repo[-sub-dirs]. */
export function slugId(owner: string, repo: string, subdir: string): string {
  const raw = [owner, repo, ...subdir.split("/")].filter(Boolean).join("-").toLowerCase();
  return raw.replace(/[^a-z0-9._-]+/g, "-").replace(/^[.-]+/, "").slice(0, 64).replace(/[.-]+$/, "") || "item";
}
