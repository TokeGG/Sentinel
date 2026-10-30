// Pure helpers for the Skills & MCP panel.
export const skillsSections = [
  { id: "skills", label: "Skills" },
  { id: "servers", label: "MCP servers" },
  { id: "install", label: "Install from GitHub" },
  { id: "market", label: "Marketplace (suggested)" },
  { id: "model", label: "Local model" },
  { id: "build", label: "Skill builder" },
];

export interface Item {
  id: string; // "skill:<id>" | "mcp:<id>"
  kind: "skill" | "mcp";
  key: string; // directory id
  name: string;
  description: string;
  bundle: string; // module id or "" (general)
  enabled: boolean;
  source: "bundled" | "github";
  repo: string;
  sha: string;
  detail: string; // MCP: the command line shown to the user
  secrets: string[]; // MCP: env var NAMES whose values live in the keychain
}
export interface Group { bundle: string; label: string; items: Item[] }

export const bundleLabel = (b: string) => (b ? b.replace(/^hub\./, "").replace(/^./, (c) => c.toUpperCase()) : "General");

/** Groups by module bundle (named bundles A-Z, General last); items keep name order. */
export function groupByBundle(items: Item[]): Group[] {
  const m = new Map<string, Item[]>();
  for (const it of items) m.set(it.bundle, [...(m.get(it.bundle) ?? []), it]);
  return [...m.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([bundle, list]) => ({ bundle, label: bundleLabel(bundle), items: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

export const shortSha = (s: string) => s.slice(0, 7);
