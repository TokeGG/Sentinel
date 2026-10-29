// Cloned-repo bookkeeping: the cloned_projects table plus the Rust folder helpers.
import { invoke } from "@tauri-apps/api/core";
import { getDb } from "../../core/db";
import { repoFromUrl, type ProjectInfo } from "./clonedLogic";

export interface Clone {
  id: number;
  repo_url: string;
  full_name: string;
  local_path: string;
  cloned_at: string;
  last_opened: string | null;
}

export async function recordClone(url: string, path: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT OR REPLACE INTO cloned_projects (repo_url, full_name, local_path) VALUES ($1, $2, $3)",
    [url, repoFromUrl(url) ?? url, path]
  );
}

export async function listClones(): Promise<Clone[]> {
  const d = await getDb();
  return d.select<Clone[]>("SELECT * FROM cloned_projects ORDER BY COALESCE(last_opened, cloned_at) DESC");
}

/** Cloned repo URLs (new table + the pre-v29 cloned_repos), for the "Cloned ✓" marker. */
export async function clonedUrls(): Promise<Set<string>> {
  const d = await getDb();
  const rows = await d.select<{ repo: string }[]>(
    "SELECT repo_url AS repo FROM cloned_projects UNION SELECT repo FROM cloned_repos"
  );
  return new Set(rows.map((r) => r.repo));
}

export const projectInfo = (path: string) => invoke<ProjectInfo>("project_info", { path });

export async function openClone(c: Clone, how: "folder" | "editor" | "terminal"): Promise<void> {
  await invoke("open_cloned", { path: c.local_path, with: how });
  const d = await getDb();
  await d.execute("UPDATE cloned_projects SET last_opened = CURRENT_TIMESTAMP WHERE id = $1", [c.id]);
}

/** Removes only the list entry; files stay. */
export async function forgetClone(id: number): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM cloned_projects WHERE id = $1", [id]);
}

/** Deletes the folder (Rust re-validates it is a git clone), then the list entry. */
export async function deleteCloneFiles(c: Clone): Promise<void> {
  await invoke("delete_cloned_dir", { path: c.local_path });
  await forgetClone(c.id);
}
