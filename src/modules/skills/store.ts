// SQLite access for installed skills / MCP servers and this module's app_settings.
import { getDb } from "../../core/db";
import type { PlanFile } from "./installPlan";

export interface SkillRow { id: string; name: string; description: string; bundle: string; repo: string; subdir: string; sha: string; enabled: number; files: string }
export interface McpRow {
  id: string; name: string; bundle: string; repo: string; subdir: string; sha: string; enabled: number;
  command: string; args: string; env: string; secret_names: string; flagged: string; files: string;
}
export const parseJson = <T,>(s: string, fallback: T): T => {
  try { return JSON.parse(s) as T; } catch { return fallback; }
};
export const filesOf = (row: { files: string }) => parseJson<PlanFile[]>(row.files, []);

export async function skillRows(): Promise<SkillRow[]> {
  return (await getDb()).select<SkillRow[]>("SELECT * FROM installed_skills ORDER BY name");
}
export async function mcpRows(): Promise<McpRow[]> {
  return (await getDb()).select<McpRow[]>("SELECT * FROM mcp_servers ORDER BY name");
}
export async function mcpRow(id: string): Promise<McpRow | undefined> {
  return (await (await getDb()).select<McpRow[]>("SELECT * FROM mcp_servers WHERE id = $1", [id]))[0];
}
export async function skillRow(id: string): Promise<SkillRow | undefined> {
  return (await (await getDb()).select<SkillRow[]>("SELECT * FROM installed_skills WHERE id = $1", [id]))[0];
}

export async function saveSkill(r: Omit<SkillRow, "enabled">, enabled: number): Promise<void> {
  await (await getDb()).execute(
    "INSERT OR REPLACE INTO installed_skills (id, name, description, bundle, repo, subdir, sha, enabled, files) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [r.id, r.name, r.description, r.bundle, r.repo, r.subdir, r.sha, enabled, r.files]
  );
}
export async function saveMcp(r: Omit<McpRow, "enabled">): Promise<void> {
  // A (re)install always starts switched off: servers only start when the user flips them on.
  await (await getDb()).execute(
    "INSERT OR REPLACE INTO mcp_servers (id, name, bundle, repo, subdir, sha, enabled, command, args, env, secret_names, flagged, files) VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12)",
    [r.id, r.name, r.bundle, r.repo, r.subdir, r.sha, r.command, r.args, r.env, r.secret_names, r.flagged, r.files]
  );
}
export async function setRowEnabled(kind: "skill" | "mcp", id: string, on: boolean): Promise<void> {
  const t = kind === "skill" ? "installed_skills" : "mcp_servers";
  await (await getDb()).execute(`UPDATE ${t} SET enabled = $1 WHERE id = $2`, [on ? 1 : 0, id]);
}
export async function deleteRow(kind: "skill" | "mcp", id: string): Promise<void> {
  const t = kind === "skill" ? "installed_skills" : "mcp_servers";
  await (await getDb()).execute(`DELETE FROM ${t} WHERE id = $1`, [id]);
}

export async function getSetting(key: string): Promise<string | null> {
  const r = await (await getDb()).select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [key]);
  return r.length ? r[0].value : null;
}
export async function setSetting(key: string, value: string): Promise<void> {
  await (await getDb()).execute("INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2", [key, value]);
}
export const LOCAL_MODEL_KEY = "local_model";
const BUNDLED_OFF = "skills_bundled_off";
export async function bundledOff(): Promise<string[]> {
  return parseJson<string[]>((await getSetting(BUNDLED_OFF)) ?? "[]", []);
}
export async function setBundledEnabled(name: string, on: boolean): Promise<void> {
  const off = new Set(await bundledOff());
  if (on) off.delete(name); else off.add(name);
  await setSetting(BUNDLED_OFF, JSON.stringify([...off]));
}
