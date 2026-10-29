import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { clipboardSections } from "./panelLogic";
import { numericId } from "../../ui/rowId";

interface ClipRow extends Record<string, unknown> {
  id: number;
  content: string;
  pinned?: number;
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
  await logActivity("clipboard", "check_clipboard", `captured a clip (${text.length} chars)`, "ok");
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

async function deleteClip(args?: Record<string, unknown>) {
  const d = await getDb();
  await d.execute("DELETE FROM clipboard_history WHERE id = $1", [numericId(args?.id)]);
  await d.execute("DELETE FROM clip_pins WHERE clip_id = $1", [numericId(args?.id)]);
  return { ok: true };
}

/** Pins live in SQLite clip_pins (migration 37); pinned clips survive Clear all and the 30-row window. */
async function togglePin(args?: Record<string, unknown>) {
  const id = numericId(args?.id);
  const d = await getDb();
  const on = args?.on === undefined ? !(await d.select<unknown[]>("SELECT 1 FROM clip_pins WHERE clip_id = $1", [id])).length : Boolean(args.on);
  if (on) await d.execute("INSERT INTO clip_pins (clip_id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
  else await d.execute("DELETE FROM clip_pins WHERE clip_id = $1", [id]);
  return { ok: true, pinned: on };
}

async function clearClips() {
  const d = await getDb();
  await d.execute("DELETE FROM clipboard_history WHERE id NOT IN (SELECT clip_id FROM clip_pins)");
  await logActivity("clipboard", "clear_clips", "cleared clipboard history (pins kept)", "ok");
  return { ok: true };
}

async function removeLaunch(args?: Record<string, unknown>) {
  const d = await getDb();
  await d.execute("DELETE FROM quick_launch_items WHERE id = $1", [numericId(args?.id)]);
  return { ok: true };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const launches = await d.select<LaunchItem[]>(
    "SELECT * FROM quick_launch_items ORDER BY label ASC"
  );
  const clips = await d.select<ClipRow[]>(
    "SELECT h.*, (p.clip_id IS NOT NULL) AS pinned FROM clipboard_history h LEFT JOIN clip_pins p ON p.clip_id = h.id WHERE p.clip_id IS NOT NULL OR h.id IN (SELECT id FROM clipboard_history ORDER BY copied_at DESC LIMIT 30) ORDER BY h.copied_at DESC"
  );
  return [
    ...launches.map((l) => ({ id: `launch-${l.id}`, title: `▶ ${l.label}`, link: undefined, label: l.label, path: l.path })),
    ...clips.map((c) => ({ id: `clip-${c.id}`, title: c.content.slice(0, 140), copied_at: c.copied_at, pinned: Boolean(c.pinned) })),
  ];
}

export const clipboardModule: ModuleManifest = {
  id: "hub.clipboard",
  name: "Clipboard & Quick-Launch",
  accent: "#a5b724",
  ring: "system",
  icon: "clipboard",
  description:
    "Quick-launch shortcuts (apps/files/folders you add) plus a clipboard history. Polling is off by default — switch on Auto-refresh to start capturing.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: clipboardSections },
  skills: [
    { name: "check_clipboard", run: checkClipboard },
    { name: "add_launch_item", run: addLaunchItem },
    { name: "launch_item", run: launchItem },
    { name: "delete_clip", run: deleteClip },
    { name: "clear_clips", run: clearClips },
    { name: "toggle_pin", run: togglePin },
    { name: "remove_launch", run: removeLaunch },
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
