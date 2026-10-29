// Install / update / remove. Nothing is written until applyPlan, which the UI
// calls only after the user confirmed the plan screen (repo, pinned SHA, files,
// and for MCP the exact command, args and env names).
import { invoke } from "@tauri-apps/api/core";
import { fetchFile, fetchTree, resolveCommit } from "./gh";
import type { Source } from "./githubUrl";
import { diffFiles, planFiles, type FileDiff, type PlanFile } from "./installPlan";
import { configOf, dropSecret, stopMcp } from "./mcp";
import { mcpConfigError, parseMcpManifest, type McpConfig } from "./mcpConfig";
import { slugId } from "./paths";
import { invalidateSkills } from "./registry";
import { parseSkillMd } from "./skillMd";
import { deleteRow, filesOf, mcpRow, parseJson, saveMcp, saveSkill, skillRow, type McpRow } from "./store";

export interface Plan {
  kind: "skill" | "mcp";
  id: string;
  name: string;
  description: string;
  bundle: string;
  source: Source;
  sha: string;
  ref: string;
  files: PlanFile[];
  skipped: { path: string; reason: string }[];
  mcp?: McpConfig;
  previousSha?: string; // set when this replaces an installed copy
  diff?: FileDiff;
}
const repoOf = (s: Source) => `${s.owner}/${s.repo}`;

/** Read-only: talks to GitHub, writes nothing. `mcp` = the config the user typed or the stored one (update). */
export async function planInstall(source: Source, kind: Plan["kind"], mcp?: McpConfig): Promise<Plan> {
  const { sha, ref } = await resolveCommit(source);
  const fp = planFiles(await fetchTree(source, sha), source.subdir);
  if (fp.error) throw new Error(fp.error);
  const id = slugId(source.owner, source.repo, source.subdir);
  const base = { kind, id, source, sha, ref, files: fp.files, skipped: fp.skipped };
  let plan: Plan;
  if (kind === "skill") {
    if (!fp.files.some((f) => f.path === "SKILL.md")) throw new Error("no SKILL.md at the top of that location");
    const doc = parseSkillMd(await fetchFile(source, sha, source.subdir ? `${source.subdir}/SKILL.md` : "SKILL.md"));
    if (!doc.ok) throw new Error(doc.error);
    plan = { ...base, name: doc.skill.name, description: doc.skill.description, bundle: doc.skill.module };
  } else {
    let cfg = mcp && mcp.command ? mcp : undefined;
    if (!cfg && fp.files.some((f) => f.path === "sentinel-mcp.json")) {
      const m = parseMcpManifest(await fetchFile(source, sha, source.subdir ? `${source.subdir}/sentinel-mcp.json` : "sentinel-mcp.json"));
      if ("error" in m) throw new Error(m.error);
      cfg = { ...m, bundle: mcp?.bundle || m.bundle };
    }
    if (!cfg) throw new Error("enter the command that starts this server (e.g. npx -y package-name)");
    const bad = mcpConfigError(cfg);
    if (bad) throw new Error(bad);
    plan = { ...base, name: id, description: "", bundle: cfg.bundle, mcp: cfg };
  }
  const old = kind === "skill" ? await skillRow(id) : await mcpRow(id);
  if (old) plan = { ...plan, previousSha: old.sha, diff: diffFiles(filesOf(old), plan.files) };
  return plan;
}

/** Writes the confirmed plan: fetch every file at the pinned SHA, write under the app dir, then record it. */
export async function applyPlan(plan: Plan): Promise<void> {
  const prefix = plan.source.subdir ? `${plan.source.subdir}/` : "";
  const files: { path: string; content: string }[] = [];
  for (const f of plan.files) files.push({ path: f.path, content: await fetchFile(plan.source, plan.sha, prefix + f.path) });
  if (plan.kind === "mcp") await stopMcp(plan.id).catch(() => undefined); // never run old code after an update
  await invoke("skills_write", { kind: plan.kind, id: plan.id, files });
  const row = { id: plan.id, name: plan.name, bundle: plan.bundle, repo: repoOf(plan.source), subdir: plan.source.subdir, sha: plan.sha, files: JSON.stringify(plan.files) };
  if (plan.kind === "skill") {
    const old = await skillRow(plan.id);
    await saveSkill({ ...row, description: plan.description }, old ? old.enabled : 1);
  } else {
    const c = plan.mcp!;
    await saveMcp({ ...row, command: c.command, args: JSON.stringify(c.args), env: JSON.stringify(c.env), secret_names: JSON.stringify(c.secretNames), flagged: JSON.stringify(c.flagged) });
  }
  await invalidateSkills();
}

/** The UI asks for confirmation first. Deletes files, row and (MCP) the keychain secrets. */
export async function removeItem(kind: Plan["kind"], id: string): Promise<void> {
  if (kind === "mcp") {
    const r = await mcpRow(id);
    await stopMcp(id).catch(() => undefined);
    for (const n of r ? parseJson<string[]>(r.secret_names, []) : []) await dropSecret(id, n).catch(() => undefined);
  }
  await invoke("skills_remove", { kind, id });
  await deleteRow(kind, id);
  await invalidateSkills();
}

export async function planUpdate(kind: Plan["kind"], id: string): Promise<Plan> {
  const r = kind === "skill" ? await skillRow(id) : await mcpRow(id);
  if (!r) throw new Error("not installed");
  const [owner, repo] = r.repo.split("/");
  const mcp = kind === "mcp" ? { ...configOf(r as McpRow), flagged: parseJson<string[]>((r as McpRow).flagged, []), bundle: r.bundle } : undefined;
  return planInstall({ owner, repo, ref: "", subdir: r.subdir }, kind, mcp);
}
