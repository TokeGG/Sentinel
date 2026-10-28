import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { getCredential } from "../../core/credentials";
import { registerModule, type ModuleManifest } from "../../core/module";

const MODULE_ID = "hub.github";
const API = "https://api.github.com";

interface RepoHit extends Record<string, unknown> {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getCredential(MODULE_ID, "pat");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let lastResults: RepoHit[] = [];

// No auth needed: public search, approximating "trending" as most-starred
// repos created in the last 14 days (GitHub has no official trending API).
async function fetchTrending() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const res = await fetch(
    `${API}/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=25`,
    { headers: await authHeaders() }
  );
  const data = (await res.json()) as { items?: RepoHit[] };
  lastResults = data.items ?? [];
  await logActivity("github", "fetch_trending", "public search, no auth", `${lastResults.length} repo(s)`);
  return { ok: true, count: lastResults.length };
}

// Needs the PAT (your own starred list is a private-ish endpoint).
async function fetchStarred() {
  const headers = await authHeaders();
  if (!headers.Authorization) {
    throw new Error("add your GitHub PAT above first (Credentials section)");
  }
  const res = await fetch(`${API}/user/starred?per_page=50`, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  lastResults = (await res.json()) as RepoHit[];
  await logActivity("github", "fetch_starred", "your starred repos", `${lastResults.length} repo(s)`);
  return { ok: true, count: lastResults.length };
}

// "Install" = clone to a folder you pick. Never executed automatically —
// see the plan doc's GitHub Discovery section for why that line is firm.
async function cloneRepo(args?: Record<string, unknown>) {
  const url = String(args?.url ?? "");
  if (!url) throw new Error("no repo url given");

  const dir = await openDialog({ directory: true, multiple: false });
  if (!dir || Array.isArray(dir)) return { ok: false, cancelled: true };

  const destDir = await invoke<string>("clone_repo", { url, destDir: dir });
  const d = await getDb();
  await d.execute("INSERT INTO cloned_repos (repo, dest_dir) VALUES ($1, $2)", [url, destDir]);
  await logActivity("github", "clone_repo", url, `cloned to ${destDir}`);
  return { ok: true, destDir };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  return lastResults.map((r) => ({
    id: r.full_name,
    title: `${r.full_name} ★${r.stargazers_count}`,
    link: r.html_url,
    label: r.description ?? undefined,
  }));
}

export const githubModule: ModuleManifest = {
  id: MODULE_ID,
  name: "GitHub Discovery",
  description:
    "Browse trending/starred repos. \"Install\" clones to a folder you pick — never auto-run.",
  panel: "list",
  skills: [
    { name: "fetch_trending", run: fetchTrending },
    { name: "fetch_starred", run: fetchStarred },
    { name: "clone_repo", run: cloneRepo },
  ],
  load: loadRows,
  actions: [
    { label: "Trending", skill: "fetch_trending" },
    { label: "My Starred", skill: "fetch_starred" },
  ],
  rowAction: { label: "Clone…", skill: "clone_repo", argName: "url", fromField: "link" },
  credentialFields: [{ key: "pat", label: "GitHub PAT (read-only)" }],
};

registerModule(githubModule);
