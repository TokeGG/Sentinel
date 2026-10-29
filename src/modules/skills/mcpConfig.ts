// Pure: what the user (or a repo's sentinel-mcp.json) declares about an MCP
// server. Output is an argument vector; nothing here ever builds a shell string.
export const ALLOWED_COMMANDS = ["npx", "uvx", "node", "python", "python3", "py", "uv", "deno", "bun", "bunx"]; // mirrors mcp_proc.rs
export interface McpConfig {
  command: string;
  args: string[];
  env: Record<string, string>; // non-secret values only
  secretNames: string[]; // values live in the OS keychain
  flagged: string[]; // tool names / categories needing an engagement target
  bundle: string;
}
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
export const isEnvName = (n: string) => ENV_NAME.test(n);

/** Whitespace split with '..' and "..", no escapes or expansion. Throws on an open quote. */
export function splitCommand(line: string): string[] {
  const out: string[] = [];
  let cur = "", has = false, q = "";
  for (const ch of String(line ?? "")) {
    if (q) { if (ch === q) q = ""; else cur += ch; }
    else if (ch === "'" || ch === '"') { q = ch; has = true; }
    else if (/\s/.test(ch)) { if (has || cur) out.push(cur); cur = ""; has = false; }
    else cur += ch;
  }
  if (q) throw new Error("unterminated quote in command");
  if (has || cur) out.push(cur);
  return out;
}

export function parseEnvLines(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    const k = i < 0 ? line : line.slice(0, i).trim();
    if (!isEnvName(k)) throw new Error(`bad env line: ${line.slice(0, 40)} (expected NAME=value)`);
    env[k] = i < 0 ? "" : line.slice(i + 1).trim();
  }
  return env;
}

export const splitNames = (s: string): string[] => [...new Set(String(s ?? "").split(/[\s,]+/).filter(Boolean))];

/** Returns an error message, or null when `c` is safe to store and run. */
export function mcpConfigError(c: McpConfig): string | null {
  if (!ALLOWED_COMMANDS.includes(c.command)) return `command must be one of: ${ALLOWED_COMMANDS.join(", ")} (needs Node.js or Python installed)`;
  if (c.args.some((a) => typeof a !== "string" || a.length > 500 || a.includes("\0"))) return "an argument is too long or invalid";
  const badEnv = [...Object.keys(c.env), ...c.secretNames].find((n) => !isEnvName(n));
  if (badEnv) return `invalid environment variable name: ${badEnv}`;
  const dup = c.secretNames.find((n) => n in c.env);
  return dup ? `${dup} is listed as both plain and secret` : null;
}

/** Reads a repo's optional sentinel-mcp.json: {command: "npx -y pkg" | "npx", args?, env?, secrets?, flagged?, bundle?}. */
export function parseMcpManifest(text: string): McpConfig | { error: string } {
  let j: Record<string, unknown>;
  try { j = JSON.parse(text); } catch { return { error: "sentinel-mcp.json is not valid JSON" }; }
  if (!j || typeof j !== "object" || typeof j.command !== "string") return { error: "sentinel-mcp.json needs a command string" };
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  try {
    const parts = splitCommand(j.command);
    const env = Object.fromEntries(Object.entries((j.env ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    const c: McpConfig = { command: parts[0] ?? "", args: [...parts.slice(1), ...strs(j.args)], env, secretNames: strs(j.secrets),
      flagged: strs(j.flagged), bundle: typeof j.bundle === "string" ? j.bundle : "" };
    return mcpConfigError(c) ? { error: mcpConfigError(c)! } : c;
  } catch (e) { return { error: String((e as Error).message) }; }
}
