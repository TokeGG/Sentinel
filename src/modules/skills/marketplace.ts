// Curated suggestions for the Skills panel's marketplace view. STATIC: nothing is fetched to build this list, and
// none of it is endorsed or verified: every entry is "suggested, verify before install". Installing one goes through
// the normal plan_install -> confirm screen (pinned SHA, exact files and command shown) like any pasted repo.
export interface MarketEntry {
  id: string;
  kind: "skill" | "mcp";
  title: string;
  description: string;
  /** What goes into the install box: owner/repo[@ref][:subdir] (parsed by githubUrl.parseSource). */
  input: string;
  /** MCP only: the command line the server is started with (shown on the confirm screen). */
  command?: string;
  category: string;
}

export const MARKET_NOTE = "Suggested, verify before install: check the repository, its owner and the exact files and command on the confirm screen.";

export const MARKET: readonly MarketEntry[] = [
  { id: "anthropic-skills", kind: "skill", title: "Anthropic example skills", description: "Example SKILL.md skills (documents, design, writing helpers) from Anthropic's public skills repository. Pick one sub-folder per install.", input: "anthropics/skills", category: "Skills" },
  { id: "mcp-fetch", kind: "mcp", title: "Fetch (web page to markdown)", description: "Reference MCP server that fetches a URL and returns it as markdown. Needs Python (uvx).", input: "modelcontextprotocol/servers:src/fetch", command: "uvx mcp-server-fetch", category: "Web" },
  { id: "mcp-filesystem", kind: "mcp", title: "Filesystem (one folder)", description: "Reference MCP server for reading/writing files inside the folders you list in its command. Needs Node (npx). Give it a narrow folder.", input: "modelcontextprotocol/servers:src/filesystem", command: "npx -y @modelcontextprotocol/server-filesystem C:/Users/YOU/Documents/bot", category: "Files" },
  { id: "mcp-memory", kind: "mcp", title: "Memory (knowledge graph)", description: "Reference MCP server that keeps a small local knowledge graph the model can add to and query. Needs Node (npx).", input: "modelcontextprotocol/servers:src/memory", command: "npx -y @modelcontextprotocol/server-memory", category: "Knowledge" },
  { id: "mcp-time", kind: "mcp", title: "Time and time zones", description: "Reference MCP server for current time and time-zone conversion. Needs Python (uvx).", input: "modelcontextprotocol/servers:src/time", command: "uvx mcp-server-time", category: "Utilities" },
  { id: "mcp-git", kind: "mcp", title: "Git (local repositories)", description: "Reference MCP server to read history, diffs and status of a local git repository. Needs Python (uvx).", input: "modelcontextprotocol/servers:src/git", command: "uvx mcp-server-git", category: "Developer" },
  { id: "mcp-thinking", kind: "mcp", title: "Sequential thinking", description: "Reference MCP server that gives the model a step-by-step scratchpad tool. Needs Node (npx).", input: "modelcontextprotocol/servers:src/sequentialthinking", command: "npx -y @modelcontextprotocol/server-sequential-thinking", category: "Reasoning" },
];

/** Entries matching a search text (title, description, category), in list order. */
export function filterMarket(q: string, list: readonly MarketEntry[] = MARKET): MarketEntry[] {
  const w = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((e) => w.every((x) => `${e.title} ${e.description} ${e.category} ${e.kind}`.toLowerCase().includes(x)));
}

/** The plan_install form for an entry (the same fields InstallPane sends). */
export const installForm = (e: MarketEntry) => ({ input: e.input, kind: e.kind, command: e.command ?? "", env: "", secrets: "", flagged: "", bundle: "" });
