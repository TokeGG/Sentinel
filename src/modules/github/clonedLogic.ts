// Pure helpers for the "Cloned repos" section (no Tauri/React/DB).
export interface ProjectInfo {
  exists: boolean;
  markers: string[];
  package_json: string | null;
  entries: number;
}

/** "https://github.com/o/r(.git)" -> "o/r", else null. */
export function repoFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = /^https:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Script names from a package.json text; [] for bad/odd input. */
export function npmScripts(text: string | null | undefined): string[] {
  if (!text) return [];
  try {
    const s = (JSON.parse(text) as { scripts?: unknown }).scripts;
    return s && typeof s === "object" && !Array.isArray(s) ? Object.keys(s).slice(0, 12) : [];
  } catch {
    return [];
  }
}

/** Human labels for the project type(s) found, e.g. ["Node (dev, build)", "Rust"]. */
export function projectTypes(info: Pick<ProjectInfo, "markers" | "package_json">): string[] {
  const has = (f: string) => info.markers.includes(f);
  const out: string[] = [];
  if (has("package.json")) {
    const s = npmScripts(info.package_json);
    out.push(s.length ? `Node, npm scripts: ${s.join(", ")}` : "Node");
  }
  if (has("Cargo.toml")) out.push("Rust");
  if (has("pyproject.toml") || has("requirements.txt")) out.push("Python");
  if (info.markers.some((m) => /\.(sln|csproj)$/i.test(m))) out.push(".NET");
  if (has("go.mod")) out.push("Go");
  if (has("pom.xml")) out.push("Java (Maven)");
  if (has("Makefile")) out.push("Make");
  return out;
}

/** What the user sees before "Delete files…" is allowed to run. */
export function deletePreview(path: string, info: ProjectInfo | undefined): string {
  const n = info?.entries ?? 0;
  return `This permanently deletes the folder ${path} and everything in it${n ? ` (${n}+ top-level items)` : ""}. It cannot be undone.`;
}

export const shortDate = (s: unknown): string => (typeof s === "string" && s ? s.slice(0, 10) : "never");
