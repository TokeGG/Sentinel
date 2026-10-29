// MCP client API for other modules and the future bot. Servers run in Rust
// (commands/mcp*.rs) and exist only after the user flipped them on this session;
// the tool list is read live from Rust, so a newly enabled server's tools appear
// at once in every webview. Flagged (pentest/scan/exploit) tools go through the scope gate.
import { invoke } from "@tauri-apps/api/core";
import { previewGate } from "../pentest/api";
import { deleteCredential, getCredential, setCredential } from "../../core/credentials";
import { SKILLS_MODULE } from "./gh";
import { makeCallMcpTool, type McpTool } from "./mcpGate";
import { mcpRow, mcpRows, parseJson, setRowEnabled, type McpRow } from "./store";

export type { McpTool };
export const listMcpTools = (): Promise<McpTool[]> => invoke<McpTool[]>("mcp_tools");

export const callMcpTool = makeCallMcpTool({
  invoke: (cmd, args) => invoke(cmd, args),
  tools: listMcpTools,
  flags: async (server) => parseJson<string[]>((await mcpRow(server))?.flagged ?? "[]", []),
  gate: previewGate,
});

export const configOf = (r: McpRow) => ({
  command: r.command,
  args: parseJson<string[]>(r.args, []),
  env: parseJson<Record<string, string>>(r.env, {}),
  secretNames: parseJson<string[]>(r.secret_names, []),
});

export async function startMcp(id: string): Promise<McpTool[]> {
  const r = await mcpRow(id);
  if (!r) throw new Error("server is not installed");
  const c = configOf(r);
  const tools = await invoke<McpTool[]>("mcp_start", { spec: { id, command: c.command, args: c.args, env: c.env, secret_names: c.secretNames } });
  await setRowEnabled("mcp", id, true);
  return tools;
}
export async function stopMcp(id: string): Promise<void> {
  await invoke("mcp_stop", { id });
  await setRowEnabled("mcp", id, false);
}

/** Running ids (Rust is the truth: game mode / app exit stop servers); the DB flag is re-synced to it. */
export async function runningServers(): Promise<string[]> {
  const ids = await invoke<string[]>("mcp_running");
  for (const r of await mcpRows()) if (!!r.enabled !== ids.includes(r.id)) await setRowEnabled("mcp", r.id, ids.includes(r.id));
  return ids;
}

const secretKey = (id: string, name: string) => `env:${id}:${name}`;
export const saveSecret = (id: string, name: string, value: string) => setCredential(SKILLS_MODULE, secretKey(id, name), value);
export const hasSecret = async (id: string, name: string) => Boolean(await getCredential(SKILLS_MODULE, secretKey(id, name)).catch(() => null));
export const dropSecret = (id: string, name: string) => deleteCredential(SKILLS_MODULE, secretKey(id, name));
