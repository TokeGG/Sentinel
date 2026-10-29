// Panel rows: bundled + installed skills and MCP servers as one Item list.
import { bundledSkills } from "./bundled";
import { configOf, runningServers } from "./mcp";
import type { Item } from "./panelLogic";
import { bundledOff, mcpRows, skillRows } from "./store";

export async function loadItems(): Promise<Item[]> {
  const off = new Set(await bundledOff());
  const items: Item[] = bundledSkills.map((s) => ({ id: `skill:bundled:${s.name}`, kind: "skill", key: s.name, name: s.name, description: s.description,
    bundle: s.module, enabled: !off.has(s.name), source: "bundled", repo: "", sha: "", detail: "", secrets: [] }));
  for (const r of await skillRows())
    items.push({ id: `skill:${r.id}`, kind: "skill", key: r.id, name: r.name, description: r.description, bundle: r.bundle, enabled: !!r.enabled, source: "github", repo: r.repo, sha: r.sha, detail: "", secrets: [] });
  const running = await runningServers();
  for (const r of await mcpRows()) {
    const c = configOf(r);
    const line = [c.command, ...c.args].join(" ");
    items.push({ id: `mcp:${r.id}`, kind: "mcp", key: r.id, name: r.name, description: line, bundle: r.bundle, enabled: running.includes(r.id), source: "github", repo: r.repo, sha: r.sha, detail: line, secrets: c.secretNames });
  }
  return items;
}
