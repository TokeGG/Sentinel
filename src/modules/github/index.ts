import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { fetch } from "@tauri-apps/plugin-http";
import { logActivity } from "../../core/db";
import { getCredential } from "../../core/credentials";
import { registerModule, type ModuleManifest } from "../../core/module";
import { clonedUrls, recordClone } from "./clones";
import { githubSections } from "./panelLogic";

const MODULE_ID = "hub.github";
const API = "https://api.github.com";

interface RepoHit extends Record<string, unknown> {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language?: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getCredential(MODULE_ID, "pat");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let lastResults: RepoHit[] = [];
let lastSource: "trending" | "starred" = "trending"; // which fetch filled lastResults (panel tabs)

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
  lastSource = "trending";
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
  lastSource = "starred";
  await logActivity("github", "fetch_starred", "your starred repos", `${lastResults.length} repo(s)`);
  return { ok: true, count: lastResults.length };
}

// "Install" = clone into a folder you pick (git creates <folder>/<repo>). Never executed automatically —
// see the plan doc's GitHub Discovery section for why that line is firm.
async function cloneRepo(args?: Record<string, unknown>) {
  const url = String(args?.url ?? "");
  if (!url) throw new Error("no repo url given");

  const dir = await openDialog({ directory: true, multiple: false });
  if (!dir || Array.isArray(dir)) return { ok: false, cancelled: true };

  const destDir = await invoke<string>("clone_repo", { url, destDir: dir });
  await recordClone(url, destDir);
  await logActivity("github", "clone_repo", url, `cloned to ${destDir}`);
  return { ok: true, destDir };
}

// Extra fields beyond id/title/link/label (kept for the generic list) feed the
// custom panel: name, stars, language and description come from the same API
// response; `cloned` is a read-only lookup in cloned_repos (repo = html_url).
async function loadRows(): Promise<Record<string, unknown>[]> {
  let cloned = new Set<string>();
  try {
    cloned = await clonedUrls();
  } catch {
    // the list still works without the "cloned" marker
  }
  return lastResults.map((r) => ({
    id: r.full_name,
    title: `${r.full_name} ★${r.stargazers_count}`,
    link: r.html_url,
    label: r.description ?? undefined,
    name: r.full_name,
    stars: r.stargazers_count,
    language: r.language ?? null,
    description: r.description ?? null,
    source: lastSource,
    cloned: cloned.has(r.html_url),
  }));
}

export const githubModule: ModuleManifest = {
  id: MODULE_ID,
  name: "GitHub Discovery",
  accent: "#bd6ece",
  ring: "security",
  icon: "github",
  description:
    "Browse trending/starred repos. \"Install\" clones to a folder you pick — never auto-run.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: githubSections },
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
