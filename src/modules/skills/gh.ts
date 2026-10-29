// GitHub access for the installer. Every URL passes assertAllowedUrl (https on
// github.com / api.github.com / raw.githubusercontent.com only), redirects are
// not followed, and the optional PAT (OS keychain) is sent to api.github.com only.
import { fetch } from "@tauri-apps/plugin-http";
import { getCredential } from "../../core/credentials";
import { assertAllowedUrl, type Source } from "./githubUrl";
import { LIMITS, type TreeEntry } from "./installPlan";

export const SKILLS_MODULE = "hub.skills";
export const PAT_KEY = "github_pat";
const encPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

async function get(url: string, api: boolean): Promise<Response> {
  assertAllowedUrl(url);
  const headers: Record<string, string> = { "User-Agent": "Sentinel", Accept: api ? "application/vnd.github+json" : "text/plain" };
  const pat = api ? await getCredential(SKILLS_MODULE, PAT_KEY).catch(() => null) : null;
  if (pat) headers.Authorization = `Bearer ${pat}`;
  const r = await fetch(url, { headers, maxRedirections: 0 } as RequestInit);
  if (r.ok) return r;
  if (r.status === 404) throw new Error("not found on GitHub (wrong name, wrong ref, or a private repo)");
  if (r.status === 403 || r.status === 429) throw new Error("GitHub rate limit reached; save a GitHub token below, or wait and retry");
  throw new Error(`GitHub answered HTTP ${r.status}`);
}

/** Pins the source to a commit: default branch (or the given ref) -> 40-hex SHA. */
export async function resolveCommit(s: Source): Promise<{ sha: string; ref: string }> {
  const base = `https://api.github.com/repos/${s.owner}/${s.repo}`;
  const ref = s.ref || ((await (await get(base, true)).json()) as { default_branch?: string }).default_branch;
  if (!ref) throw new Error("could not determine the default branch");
  const c = (await (await get(`${base}/commits/${encPath(ref)}`, true)).json()) as { sha?: string };
  if (!c.sha || !/^[0-9a-f]{40}$/.test(c.sha)) throw new Error("GitHub returned no commit SHA");
  return { sha: c.sha, ref };
}

export async function fetchTree(s: Source, sha: string): Promise<TreeEntry[]> {
  const j = (await (await get(`https://api.github.com/repos/${s.owner}/${s.repo}/git/trees/${sha}?recursive=1`, true)).json()) as {
    tree?: { path: string; type: string; size?: number; sha: string }[];
    truncated?: boolean;
  };
  if (j.truncated) throw new Error("repository is too large to list; point at a sub-directory with owner/repo:dir");
  return (j.tree ?? []).map((t) => ({ path: t.path, type: t.type, size: t.size, sha: t.sha }));
}

/** One file at the pinned commit (never a branch name). */
export async function fetchFile(s: Source, sha: string, path: string): Promise<string> {
  const text = await (await get(`https://raw.githubusercontent.com/${s.owner}/${s.repo}/${sha}/${encPath(path)}`, false)).text();
  if (text.length > LIMITS.file || text.includes("\0")) throw new Error(`${path} is too large or not text`);
  return text;
}
