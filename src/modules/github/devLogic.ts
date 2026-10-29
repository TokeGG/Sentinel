// Pure GitHub/dev helpers: porcelain status, CI verdicts, inbox rows, commit stats, README prompt.
export interface GitStatus { branch: string; ahead: number; behind: number; changed: number; untracked: number; files: string[] }

/** Parses `git status --porcelain=v1 -b`. */
export function parseStatus(text: string): GitStatus {
  const s: GitStatus = { branch: "", ahead: 0, behind: 0, changed: 0, untracked: 0, files: [] };
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      s.branch = line.slice(3).split("...")[0].replace(/^No commits yet on /, "");
      s.ahead = Number(/ahead (\d+)/.exec(line)?.[1] ?? 0);
      s.behind = Number(/behind (\d+)/.exec(line)?.[1] ?? 0);
    } else if (line.startsWith("?? ")) { s.untracked++; s.files.push(line); }
    else if (line.trim()) { s.changed++; s.files.push(line); }
  }
  return s;
}
export const statusText = (s: GitStatus) =>
  `${s.branch || "?"}${s.ahead ? ` ↑${s.ahead}` : ""}${s.behind ? ` ↓${s.behind}` : ""} · ${s.changed} changed · ${s.untracked} untracked`;

export type Ci = "success" | "failure" | "running" | "none";
/** Latest workflow run -> verdict. */
export function ciVerdict(run: { status?: string; conclusion?: string | null } | undefined): Ci {
  if (!run) return "none";
  if (run.status !== "completed") return "running";
  return run.conclusion === "success" || run.conclusion === "skipped" || run.conclusion === "neutral" ? "success" : "failure";
}
export const failingCount = (m: Record<string, Ci>) => Object.values(m).filter((v) => v === "failure").length;

export interface InboxItem { id: number; title: string; repo: string; url: string; kind: "PR" | "Issue"; updated: string; number: number }
/** Search API issues -> inbox rows (newest first). */
export function inboxRows(items: Record<string, unknown>[]): InboxItem[] {
  return items.map((i) => ({
    id: Number(i.id), title: String(i.title ?? ""), url: String(i.html_url ?? ""), number: Number(i.number),
    repo: String(i.repository_url ?? "").replace("https://api.github.com/repos/", ""),
    kind: (i.pull_request ? "PR" : "Issue") as "PR" | "Issue", updated: String(i.updated_at ?? ""),
  })).sort((a, b) => b.updated.localeCompare(a.updated));
}

/** stats/commit_activity -> weekly totals (oldest first); anything malformed -> []. */
export const weeklyTotals = (j: unknown) => (Array.isArray(j) ? j.map((w) => Number((w as { total?: number }).total) || 0) : []);

/** Prompt for the local model; only names and the package description go in, never file contents. */
export function readmePrompt(name: string, markers: string[], pkg: string | null): string {
  let desc = "", scripts: string[] = [];
  try { const p = pkg ? JSON.parse(pkg) : null; desc = String(p?.description ?? ""); scripts = Object.keys(p?.scripts ?? {}); } catch { /* ignore */ }
  return [`Draft a concise README.md for the project "${name}".`, desc && `Description: ${desc}`,
    markers.length ? `Project files: ${markers.join(", ")}` : "", scripts.length ? `npm scripts: ${scripts.join(", ")}` : "",
    "Sections: title, one-paragraph summary, install, usage, license placeholder. Do not invent features. Markdown only."].filter(Boolean).join("\n");
}
