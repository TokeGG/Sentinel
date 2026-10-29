// Pure parsing of what the user pastes into the install box, plus the host
// allow-list every network call must pass. https only; nothing else is fetched.
import { cleanRel } from "./paths.ts";

export const ALLOWED_HOSTS = ["github.com", "api.github.com", "raw.githubusercontent.com"];

export interface Source {
  owner: string;
  repo: string;
  ref: string; // "" = the repo's default branch
  subdir: string; // "" = repo root
}
export type Parsed = { ok: true; source: Source } | { ok: false; error: string };

/** Throws unless `url` is https on an allow-listed host (no credentials, no port). */
export function assertAllowedUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`not a URL: ${url}`);
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port || !ALLOWED_HOSTS.includes(u.hostname))
    throw new Error(`blocked: only https on ${ALLOWED_HOSTS.join(", ")} is allowed`);
  return u;
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9._\/-]{1,100}$/;
const bad = (error: string): Parsed => ({ ok: false, error });

function finish(owner: string, repoRaw: string, ref: string, subdir: string): Parsed {
  const repo = repoRaw.replace(/\.git$/, "");
  if (!OWNER.test(owner)) return bad("invalid owner name");
  if (!REPO.test(repo) || repo === "." || repo === "..") return bad("invalid repository name");
  if (ref && (!REF.test(ref) || ref.includes("..") || ref.startsWith("/") || ref.endsWith("/"))) return bad("invalid ref");
  if (subdir.startsWith("/")) return bad("invalid sub-directory");
  const sub = subdir.replace(/\/+$/g, "");
  if (sub && cleanRel(sub) === null) return bad("invalid sub-directory");
  return { ok: true, source: { owner, repo, ref, subdir: sub } };
}

/**
 * Accepts: owner/repo, owner/repo@ref, owner/repo:subdir, owner/repo@ref:subdir,
 * https://github.com/owner/repo[.git], and .../tree/<ref>[/<subdir>] (ref = one
 * path segment; use the @ref form for refs containing "/").
 */
export function parseSource(input: string): Parsed {
  const t = String(input ?? "").trim();
  if (!t) return bad("paste a GitHub repository URL or owner/repo");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) {
    let u: URL;
    try {
      u = new URL(t);
    } catch {
      return bad("not a valid URL");
    }
    if (u.protocol !== "https:") return bad("only https:// URLs are accepted");
    if (u.hostname !== "github.com" || u.username || u.password || u.port) return bad("only github.com repositories are supported");
    const p = u.pathname.split("/").filter(Boolean);
    if (p.length < 2) return bad("URL needs /owner/repo");
    if (p.length === 2) return finish(p[0], p[1], "", "");
    if (p[2] !== "tree" || p.length < 4) return bad("unsupported URL; use the repo URL or a /tree/<ref>/<dir> link");
    return finish(p[0], p[1], p[3], p.slice(4).join("/"));
  }
  const m = /^([^/\s@:]+)\/([^/\s@:]+)(?:@([^\s:]+))?(?::(\S+))?$/.exec(t);
  return m ? finish(m[1], m[2], m[3] ?? "", m[4] ?? "") : bad("expected owner/repo or a github.com URL");
}
