// The panel's write operations, exposed to it as manifest skills (so busy/error handling is shared).
import { fetch } from "@tauri-apps/plugin-http";
import { applyPlan, planInstall, planUpdate, removeItem, type Plan } from "./install";
import { parseSource } from "./githubUrl";
import { invalidateSkills } from "./registry";
import { isLocalUrl, OLLAMA_TAGS_URL, parseTags, type LocalModel } from "./localModel";
import { saveSecret, startMcp, stopMcp } from "./mcp";
import { parseEnvLines, splitCommand, splitNames, type McpConfig } from "./mcpConfig";
import { getSetting, LOCAL_MODEL_KEY, setBundledEnabled, setRowEnabled, setSetting } from "./store";

type A = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");

export async function setEnabled(a?: A) {
  const kind = a?.kind as "skill" | "mcp", key = str(a?.key), on = Boolean(a?.enabled);
  if (kind === "mcp") await (on ? startMcp(key) : stopMcp(key)); // starts only on this explicit flip
  else if (a?.source === "bundled") await setBundledEnabled(key, on);
  else await setRowEnabled("skill", key, on);
  await invalidateSkills();
  return { ok: true };
}

export async function planFromForm(a?: A): Promise<Plan> {
  const p = parseSource(str(a?.input));
  if (!p.ok) throw new Error(p.error);
  const kind = a?.kind === "mcp" ? "mcp" : "skill";
  let mcp: McpConfig | undefined;
  if (kind === "mcp") {
    const parts = splitCommand(str(a?.command));
    mcp = { command: parts[0] ?? "", args: parts.slice(1), env: parseEnvLines(str(a?.env)), secretNames: splitNames(str(a?.secrets)),
      flagged: splitNames(str(a?.flagged)), bundle: str(a?.bundle).trim() };
  }
  return planInstall(p.source, kind, mcp);
}

export const updatePlan = (a?: A) => planUpdate(a?.kind === "mcp" ? "mcp" : "skill", str(a?.key));
export async function confirmPlan(a?: A) {
  await applyPlan(a?.plan as Plan); // the UI sends the plan the user just confirmed
  return { ok: true };
}
export async function removeInstalled(a?: A) {
  await removeItem(a?.kind === "mcp" ? "mcp" : "skill", str(a?.key));
  return { ok: true };
}
export async function saveEnvSecret(a?: A) {
  if (!str(a?.value)) throw new Error("enter a value");
  await saveSecret(str(a?.key), str(a?.name), str(a?.value));
  return { ok: true };
}

export async function listModels(): Promise<{ models: LocalModel[]; current: string }> {
  if (!isLocalUrl(OLLAMA_TAGS_URL)) throw new Error("local models only");
  const r = await fetch(OLLAMA_TAGS_URL).catch(() => { throw new Error("Ollama is not reachable on 127.0.0.1:11434 - is it running?"); });
  if (!r.ok) throw new Error(`Ollama answered HTTP ${r.status}`);
  return { models: parseTags(await r.json()), current: (await getSetting(LOCAL_MODEL_KEY)) ?? "" };
}
export async function saveModel(a?: A) {
  await setSetting(LOCAL_MODEL_KEY, str(a?.name));
  return { ok: true };
}
