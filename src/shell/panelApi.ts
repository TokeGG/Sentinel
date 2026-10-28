// Thin, STATELESS wrappers over the Rust panel commands (Task 9b): Rust is the
// only source of truth for rects and z; every rect is clamped before it
// reaches Rust (Rust does not clamp open_panel). Persistence: `commit()`.
import { invoke } from "@tauri-apps/api/core";
import { registry, type ModuleManifest } from "../core/module";
import { cascade, clampToScreen, type Rect } from "./layout";
import { deleteLayout, loadLayout, saveLayout } from "./layoutStore";

export type SavedPanel = { id: string; rect: Rect; state: string; z: number };

export const MIN = { w: 240, h: 160 }; // matches persist.rs MIN_W/MIN_H
const DEFAULT_SIZE = { w: 560, h: 420 };
let opened = 0; // cascade slot only; main window's own counter

export const screenRect = (): Rect => ({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
const clamp = (r: Rect) => clampToScreen(r, screenRect(), MIN);

/** Main window entry. Re-opening an open panel keeps its current rect. */
export async function openPanel(m: ModuleManifest, rect?: Rect): Promise<void> {
  const cur = rect ?? (await getPanel(m.id).then((p) => p.rect, () => undefined));
  const r = clamp(cur ?? cascade(opened++, screenRect(), DEFAULT_SIZE));
  const web = m.panel === "web" ? m.web : undefined;
  await invoke("open_panel", { id: m.id, url: web?.url, profile: web?.profile, rect: r });
  await commit(await getPanel(m.id));
}

// Row first: called from a chrome webview, close_panel destroys the caller
// before its reply arrives, so nothing after the invoke would run.
export async function closePanel(id: string): Promise<void> {
  await deleteLayout(id);
  await invoke("close_panel", { id });
}

/** Raise (no-op in Rust if already top) and persist the authoritative z. */
export async function focusPanel(id: string): Promise<SavedPanel> {
  const p = await invoke<SavedPanel>("focus_panel", { id });
  await commit(p);
  return p;
}

export const getPanel = (id: string) => invoke<SavedPanel>("get_panel", { id });

// During a pointer drag: invoke only, no persistence (commit on pointerup).
export const dragMove = (id: string, x: number, y: number) =>
  invoke<SavedPanel>("move_panel", { id, x, y });
export const dragResize = (id: string, w: number, h: number) =>
  invoke<SavedPanel>("resize_panel", { id, w, h });

export const commit = (p: SavedPanel) => saveLayout(p.id, p.rect, p.z, p.state);

// Startup: reopen panels saved as open. Unknown module ids are skipped (a
// module may have been removed); one failing panel never stops the others.
// Memoized: React StrictMode runs mount effects twice in dev.
let restoring: Promise<void> | null = null;
export function restore(): Promise<void> {
  return (restoring ??= doRestore());
}
async function doRestore(): Promise<void> {
  const known = new Map(registry.map((m) => [m.id, m]));
  const rows = (await loadLayout()).filter((r) => known.has(r.module_id));
  const saved = await invoke<SavedPanel[]>("restore_layout", { rows, screen: screenRect() });
  for (const p of saved) {
    if (p.state !== "open") continue;
    try {
      await openPanel(known.get(p.id)!, p.rect);
    } catch (e) {
      console.error(`restore ${p.id} failed`, e);
    }
  }
}
