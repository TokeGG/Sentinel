// GitHub API calls for the dev tools (inbox, CI, gists, commit stats) + the local-model README draft.
// Every call runs only from a button press; the token comes from Connect or the keychain PAT.
import { fetch } from "@tauri-apps/plugin-http";
import { logActivity } from "../../core/db";
import { ollamaJson } from "../bot/llm";
import { getSetting, LOCAL_MODEL_KEY } from "../skills/store";
import { authHeaders } from "./auth";
import { ciVerdict, inboxRows, weeklyTotals, type Ci, type InboxItem } from "./devLogic";

const API = "https://api.github.com";

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const h = await authHeaders();
  if (!h.Authorization) throw new Error("connect GitHub (Settings > Accounts) or add a PAT first");
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...h, Accept: "application/vnd.github+json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return (await res.json()) as T;
}

let ci: Record<string, Ci> = {};
export const lastCi = () => ci;

export async function fetchInbox(): Promise<InboxItem[]> {
  const me = await gh<{ login: string }>("/user");
  const q = encodeURIComponent(`is:open archived:false involves:${me.login}`);
  const r = await gh<{ items: Record<string, unknown>[] }>(`/search/issues?q=${q}&sort=updated&per_page=50`);
  await logActivity("github", "inbox", "open PRs/issues involving you", `${r.items.length}`);
  return inboxRows(r.items);
}

/** Latest workflow run of your 10 most recently pushed repos; kept in memory for the CI moon. */
export async function fetchCi(): Promise<Record<string, Ci>> {
  const repos = await gh<{ full_name: string }[]>("/user/repos?sort=pushed&per_page=10&affiliation=owner");
  const out: Record<string, Ci> = {};
  for (const r of repos) {
    const runs = await gh<{ workflow_runs: { status?: string; conclusion?: string | null }[] }>(`/repos/${r.full_name}/actions/runs?per_page=1`).catch(() => ({ workflow_runs: [] }));
    out[r.full_name] = ciVerdict(runs.workflow_runs[0]);
  }
  ci = out;
  return out;
}

export interface Gist { id: string; html_url: string; description: string | null; files: Record<string, unknown>; updated_at: string }
export const listGists = () => gh<Gist[]>("/gists?per_page=30");
export async function createGist(name: string, content: string, isPublic: boolean): Promise<Gist> {
  const g = await gh<Gist>("/gists", { method: "POST", body: JSON.stringify({ public: isPublic, files: { [name]: { content } } }) });
  await logActivity("github", "create_gist", name, isPublic ? "public" : "secret");
  return g;
}

/** Weekly commit totals for the last year (GitHub may answer 202 while computing: try again). */
export async function commitStats(fullName: string): Promise<number[]> {
  return weeklyTotals(await gh<unknown>(`/repos/${fullName}/stats/commit_activity`).catch(() => []));
}

/** Draft only: shown for review/copy, never written to the repo. Local Ollama (127.0.0.1) only. */
export async function draftReadme(prompt: string): Promise<string> {
  const model = (await getSetting(LOCAL_MODEL_KEY)) ?? "";
  const raw = await ollamaJson({ fetch: window.fetch.bind(window), model }, [
    { role: "system", content: 'Reply as JSON {"readme": "<markdown>"}.' }, { role: "user", content: prompt }]);
  try { return String((JSON.parse(raw) as { readme?: unknown }).readme ?? raw); } catch { return raw; }
}
