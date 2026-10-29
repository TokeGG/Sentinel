// MCP glue for the bot (Tauri-coupled): the toolGate handed to runAgent and the runner the driver uses.
// Execution goes through callMcpTool, i.e. the existing gate path; the bot passes no engagement, so flagged tools fail there too.
import type { Action } from "./actions";
import { callMcpTool, listMcpTools } from "../skills/mcp";
import { mcpRow, parseJson } from "../skills/store";
import { botToolVerdict } from "./toolGate";

type ToolAction = Extract<Action, { type: "tool" }>;

export async function botToolGate(a: ToolAction) {
  const meta = (await listMcpTools()).find((t) => t.server === a.server && t.name === a.name);
  const flags = parseJson<string[]>((await mcpRow(a.server))?.flagged ?? "[]", []);
  return botToolVerdict(meta, flags);
}
export async function botRunTool(a: ToolAction): Promise<string> {
  const r = await callMcpTool(a.server, a.name, a.args);
  return (typeof r === "string" ? r : JSON.stringify(r)).slice(0, 2000);
}
