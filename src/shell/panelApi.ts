// Thin, STATELESS wrappers over the Rust panel commands (Task 9b): Rust is the
// only source of truth for rects and z; every rect is clamped before it
// reaches Rust (Rust does not clamp open_panel). Persistence: `commit()`.
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { registry, type ModuleManifest } from "../core/module";
import type { WebConfig } from "../core/manifestChecks";
import { cascade, clampToScreen, clientRect, type Rect } from "./layout";
import { deleteLayout, loadLayout, saveLayout } from "./layoutStore";
import { getRestorePanels } from "./settingsStore";

export type SavedPanel = { id: string; rect: Rect; state: string; z: number };

export const MIN = { w: 240, h: 160 }; // matches persist.rs MIN_W/MIN_H
const DEFAULT_SIZE = { w: 560, h: 420 };
let opened = 0; // cascade slot only; main window's own counter

// Chrome webviews never open the database (a second plugin-sql load there
// swaps the shared pool); they ask the main window to persist instead.
export const LAYOUT_COMMIT = "layout-commit";
export const LAYOUT_DELETE = "layout-delete";
const inChrome = () => window.location.hash.startsWith("#/chrome/");

// Panel rects are relative to the MAIN window's client area. In any child
// webview (chrome strip, Settings panel) window.inner* is that webview's own
// size, so always measure the main window (getCurrentWindow() is the main
// window when called from it). Not unit-testable here (needs Tauri); the
// size math is the pure clientRect() in layout.ts.
export async function mainClientRect(): Promise<Rect> {
  const fallback: Rect = { x: 0, y: 0, w: window.screen.availWidth, h: window.screen.availHeight };
  try {
    const w = getCurrentWindow();
    const s = await w.innerSize();
    return clientRect(s.width, s.height, await w.scaleFactor(), fallback);
  } catch {
    return fallback;
  }
}

/** Main window entry. Re-opening an open panel keeps its current rect. */
export function openPanel(m: ModuleManifest, rect?: Rect): Promise<void> {
  const web = m.panel === "web" ? m.web : undefined;
  return openAt(m.id, web?.size ?? DEFAULT_SIZE, web, rect, web?.min);
}

async function openAt(id: string, size: { w: number; h: number }, web?: WebConfig, rect?: Rect, min = MIN) {
  const cur = rect ?? (await getPanel(id).then((p) => p.rect, () => undefined));
  const screen = await mainClientRect();
  const r = clampToScreen(cur ?? cascade(opened++, screen, size), screen, min);
  await invoke("open_panel", { id, url: web?.url, profile: web?.profile, hosts: web?.hosts, rect: r });
  await commit(await getPanel(id));
}

// Settings is NOT a module (not in the registry, never a planet); the HUD
// opens it explicitly. restore() ignores its saved row (unknown id).
export const SETTINGS_ID = "hub.settings";
export const openSettings = (): Promise<void> => openAt(SETTINGS_ID, { w: 560, h: 520 });

// Row first: called from a chrome webview, close_panel destroys the caller
// before its reply arrives, so nothing after the invoke would run.
export async function closePanel(id: string): Promise<void> {
  if (inChrome()) await emit(LAYOUT_DELETE, { id });
  else await deleteLayout(id);
  await invoke("close_panel", { id });
}

/** Raise (no-op in Rust if already top) and persist the authoritative z. */
export async function focusPanel(id: string): Promise<SavedPanel> {
  const p = await invoke<SavedPanel>("focus_panel", { id });
  await commit(p);
  return p;
}

/** Web panels: fill the main window client area, or restore the previous rect. */
export async function toggleFullWindow(id: string): Promise<boolean> {
  const [p, full] = await invoke<[SavedPanel, boolean]>("toggle_full_window", { id, screen: await mainClientRect() });
  await commit(p);
  return full;
}

export const getPanel = (id: string) => invoke<SavedPanel>("get_panel", { id });

// During a pointer drag: invoke only, no persistence (commit on pointerup).
export const dragMove = (id: string, x: number, y: number) =>
  invoke<SavedPanel>("move_panel", { id, x, y });
export const dragResize = (id: string, w: number, h: number) =>
  invoke<SavedPanel>("resize_panel", { id, w, h });

export const commit = (p: SavedPanel): Promise<void> =>
  inChrome() ? emit(LAYOUT_COMMIT, p) : saveLayout(p.id, p.rect, p.z, p.state);

// Startup: reopen panels saved as open. Unknown module ids are skipped (a
// module may have been removed); one failing panel never stops the others.
// Memoized: React StrictMode runs mount effects twice in dev.
let restoring: Promise<void> | null = null;
export function restore(): Promise<void> {
  return (restoring ??= doRestore());
}
async function doRestore(): Promise<void> {
  // Default ON; a failed read must not strand the user with no panels.
  if (!(await getRestorePanels().catch(() => true))) return;
  const known = new Map(registry.map((m) => [m.id, m]));
  const rows = (await loadLayout()).filter((r) => known.has(r.module_id));
  const saved = await invoke<SavedPanel[]>("restore_layout", { rows, screen: await mainClientRect() });
  for (const p of saved) {
    if (p.state !== "open") continue;
    try {
      await openPanel(known.get(p.id)!, p.rect);
    } catch (e) {
      console.error(`restore ${p.id} failed`, e);
    }
  }
}
