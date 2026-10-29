import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { filesearchSections } from "./panelLogic";

let lastResults: { path: string }[] = [];

async function addRoot() {
  const dir = await openDialog({ directory: true, multiple: false });
  if (!dir || Array.isArray(dir)) return { ok: false, cancelled: true };
  const d = await getDb();
  await d.execute("INSERT OR IGNORE INTO search_roots (path) VALUES ($1)", [dir]);
  return { ok: true };
}

async function removeRoot(args?: Record<string, unknown>) {
  const path = String(args?.path ?? "");
  if (!path) throw new Error("folder path missing");
  const d = await getDb();
  await d.execute("DELETE FROM search_roots WHERE path = $1", [path]);
  lastResults = lastResults.filter((r) => !r.path.startsWith(path));
  await logActivity("filesearch", "remove_root", "removed a search folder", "ok");
  return { ok: true };
}

async function search(args?: Record<string, unknown>) {
  const query = String(args?.query ?? "").trim();
  if (!query) throw new Error("query is empty");

  const d = await getDb();
  const roots = await d.select<{ path: string }[]>("SELECT path FROM search_roots");
  if (roots.length === 0) {
    throw new Error('add a folder first ("Add folder")');
  }

  lastResults = [];
  for (const root of roots) {
    const hits = await invoke<{ path: string }[]>("search_files", { root: root.path, query });
    lastResults.push(...hits);
  }
  await logActivity("filesearch", "search", query, `${lastResults.length} match(es) across ${roots.length} folder(s)`);
  return { ok: true, count: lastResults.length };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  // Read-only extra rows (kind "root") so the panel can show the saved folders.
  const d = await getDb();
  const roots = await d.select<{ path: string }[]>("SELECT path FROM search_roots ORDER BY path");
  return [
    ...roots.map((r, i) => ({ id: `root-${i}`, kind: "root", title: r.path, path: r.path })),
    ...lastResults.map((r, i) => ({ id: i, kind: "result", title: r.path, path: r.path })),
  ];
}

export const fileSearchModule: ModuleManifest = {
  id: "hub.filesearch",
  name: "Local File Search",
  accent: "#03c0d8",
  ring: "system",
  icon: "filesearch",
  description:
    "Filename search over folders you add — not full-disk indexing, scoped to exactly what you've added.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: filesearchSections },
  skills: [
    { name: "add_root", run: addRoot },
    { name: "search", run: search },
    { name: "remove_root", run: removeRoot },
    { name: "open_result", run: async (args) => { await openPath(String(args?.path ?? "")); return { ok: true }; } },
  ],
  load: loadRows,
  quickAdd: { skill: "search", argName: "query", placeholder: "Search filenames…" },
  actions: [{ label: "Add folder to search", skill: "add_root" }],
  rowAction: { label: "Open", skill: "open_result", argName: "path", fromField: "path" },
};

registerModule(fileSearchModule);
