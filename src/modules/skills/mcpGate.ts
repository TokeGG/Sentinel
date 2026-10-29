// Pure safety wrapper around MCP tool calls. A tool whose name/declared
// category looks like pentest/scan/exploit (or that the server config flags) is
// callable only with an engagement target that passes the pentest scope gate;
// otherwise the Rust invoke is never reached.
export interface McpTool {
  server: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
  category?: string;
  annotations?: { category?: string };
  _meta?: { category?: string };
}
export interface Engagement { id: number; target: string }
export interface Verdict { allowed: boolean; reason: string }
export interface GateDeps {
  invoke(cmd: string, args: Record<string, unknown>): Promise<unknown>;
  tools(): Promise<McpTool[]>;
  flags(server: string): Promise<string[]>; // per-server `flagged` config
  gate(engagementId: number, target: string): Promise<Verdict>; // pentest previewGate
}

const RISKY = /pentest|scan|exploit/i;

export function isFlagged(t: McpTool, configFlags: string[]): boolean {
  const cat = String(t.category ?? t.annotations?.category ?? t._meta?.category ?? "");
  const flags = configFlags.map((f) => f.toLowerCase());
  return RISKY.test(t.name) || RISKY.test(cat) || flags.includes(t.name.toLowerCase()) || (!!cat && flags.includes(cat.toLowerCase()));
}

/** True when some string anywhere in `args` contains `target` (the call must really aim at the checked target). */
export function argsMention(args: unknown, target: string): boolean {
  const t = target.trim().toLowerCase();
  const walk = (v: unknown): boolean =>
    typeof v === "string" ? t !== "" && v.toLowerCase().includes(t) : Array.isArray(v) ? v.some(walk) : v && typeof v === "object" ? Object.values(v).some(walk) : false;
  return walk(args);
}

export function makeCallMcpTool(deps: GateDeps) {
  return async (server: string, tool: string, args: Record<string, unknown> = {}, opts?: { engagement?: Engagement }): Promise<unknown> => {
    const meta = (await deps.tools()).find((t) => t.server === server && t.name === tool);
    if (!meta) throw new Error(`tool ${tool} is not available (is server ${server} switched on?)`);
    if (isFlagged(meta, await deps.flags(server))) {
      const e = opts?.engagement;
      if (!e) throw new Error(`${tool} is flagged pentest/scan/exploit: pass an engagement target that is in scope`);
      if (!argsMention(args, e.target)) throw new Error(`${tool}: the call arguments must contain the engagement target`);
      const v = await deps.gate(e.id, e.target);
      if (!v.allowed) throw new Error(`${tool} refused by the pentest scope gate: ${v.reason}`);
    }
    return deps.invoke("mcp_call", { id: server, tool, args });
  };
}
