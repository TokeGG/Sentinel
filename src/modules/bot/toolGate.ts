// The bot's verdict on a tool action BEFORE it runs. The real gate is skills/mcpGate (callMcpTool), which the driver
// uses to execute; this pre-check turns its refusals into clear step errors without calling Rust. The bot has no
// engagement, so a pentest/scan/exploit-flagged tool can never pass: it is refused here and again by callMcpTool.
import { isFlagged, type McpTool, type Verdict } from "../skills/mcpGate.ts";

export function botToolVerdict(meta: McpTool | undefined, configFlags: string[]): Verdict {
  if (!meta) return { allowed: false, reason: "that tool is not available (is its MCP server switched on?)" };
  if (isFlagged(meta, configFlags)) return { allowed: false, reason: "flagged pentest/scan/exploit: needs an engagement target in scope, which the browser bot cannot supply" };
  return { allowed: true, reason: "" };
}
