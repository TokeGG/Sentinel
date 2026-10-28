import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";

interface ClipRow extends Record<string, unknown> {
  id: number;
  content: string;
  copied_at: string;
}

interface LaunchItem extends Record<string, unknown> {
  id: number;
  label: string;
  path: string;
}

let lastSeen = "";

// Polled, not event-driven — Tauri's clipboard plugin has no change
// notification, so a module-scoped poll (only runs while this module's
// schedule is switched on) is the simplest option that still respects
// "no background task without explicit enable."
async function checkClipboard() {
  const text = await readText().catch(() => null);
  if (!text || text === lastSeen) return { ok: true, captured: false };
  lastSeen = text;

  const d = await getDb();
  await d.execute("INSERT INTO clipboard_history (content) VALUES ($1)", [text]);
  await logActivity("clipboard", "check_clipboard", "new clipboard content", text.slice(0, 60));
  return { ok: true, captured: true };
}

async function addLaunchItem(args?: Record<string, unknown>) {
  const raw = String(args?.item ?? "").trim();
  if (!raw) throw new Error("item is empty");
  // "Label|path/to/thing" or just a bare path (path used as its own label).
  const [label, path] = raw.includes("|") ? raw.split("|") : [raw, raw];
  const d = await getDb();
  await d.execute("INSERT INTO quick_launch_items (label, path) VALUES ($1, $2)", [
    label.trim(),
    path.trim(),
  ]);
  return { ok: true };
}

async function launchItem(args?: Record<string, unknown>) {
  const path = String(args?.path ?? "");
  if (!path) throw new Error("no path given");
  await openPath(path);
  await logActivity("clipboard", "launch_item", path, "opened");
  return { ok: true };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const launches = await d.select<LaunchItem[]>(
    "SELECT * FROM quick_launch_items ORDER BY label ASC"
  );
  const clips = await d.select<ClipRow[]>(
    "SELECT * FROM clipboard_history ORDER BY copied_at DESC LIMIT 30"
  );
  return [
    ...launches.map((l) => ({ id: `launch-${l.id}`, title: `▶ ${l.label}`, link: undefined, path: l.path })),
    ...clips.map((c) => ({ id: `clip-${c.id}`, title: c.content.slice(0, 140) })),
  ];
}

export const clipboardModule: ModuleManifest = {
  id: "hub.clipboard",
  name: "Clipboard & Quick-Launch",
  description:
    "Quick-launch shortcuts (apps/files/folders you add) plus a clipboard history. Polling is off by default — switch on Auto-check to start capturing.",
  panel: "list",
  skills: [
    { name: "check_clipboard", run: checkClipboard },
    { name: "add_launch_item", run: addLaunchItem },
    { name: "launch_item", run: launchItem },
  ],
  load: loadRows,
  quickAdd: {
    skill: "add_launch_item",
    argName: "item",
    placeholder: 'Add a quick-launch item ("Label|C:\\path\\to\\app.exe")…',
  },
  actions: [{ label: "Check clipboard now", skill: "check_clipboard" }],
  rowAction: { label: "Open", skill: "launch_item", argName: "path", fromField: "path" },
  schedule: { skill: "check_clipboard", intervalMinutes: 1 },
};

registerModule(clipboardModule);
