// Thin, STATELESS wrappers over the Rust panel commands (Task 9b): Rust is the
// only source of truth for rects and z; every rect is clamped before it
// reaches Rust (Rust does not clamp open_panel). Persistence: `commit()`.
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { registry, type ModuleManifest } from "../core/module";
import type { WebConfig } from "../core/manifestChecks";
import { cascade, clampToScreen, clientRect, reclamp, TITLEBAR_H, type Rect } from "./layout";
import { deleteLayout, loadLayout, saveLayout } from "./layoutStore";
import { keepKnown } from "./restoreLogic";
import { getRestorePanels } from "./settingsStore";
import { DESK_SIZES, PANEL_CLOSED, PANEL_FOCUSED } from "./desk/ids";
import { launchRows } from "./desk/launch";

export type SavedPanel = { id: string; rect: Rect; state: string; z: number };

export const MIN = { w: 240, h: 160 }; // matches persist.rs MIN_W/MIN_H
const DEFAULT_SIZE = { w: 560, h: 420 };
let opened = 0; // cascade slot only; main window's own counter

// Chrome webviews never open the database (a second plugin-sql load there
// swaps the shared pool); they ask the main window to persist instead.
export const LAYOUT_COMMIT = "layout-commit";
export const LAYOUT_DELETE = "layout-delete";
const inChrome = () => /^#\/(chrome|grip)\//.test(window.location.hash);

// Panel rects are relative to the MAIN window's client area (the window is
// frameless, so that is the whole window) minus the custom title bar band. In any child
// webview (chrome strip, Settings panel) window.inner* is that webview's own
// size, so always measure the main window (getCurrentWindow() is the main
// window when called from it). Not unit-testable here (needs Tauri); the
// size math is the pure clientRect() in layout.ts.
export async function mainClientRect(): Promise<Rect> {
  const fallback: Rect = { x: 0, y: TITLEBAR_H, w: window.screen.availWidth, h: window.screen.availHeight - TITLEBAR_H };
  try {
    const w = getCurrentWindow();
    const s = await w.innerSize();
    return clientRect(s.width, s.height, await w.scaleFactor(), fallback, TITLEBAR_H);
  } catch {
    return fallback;
  }
}

/** Main window entry. Re-opening an open panel keeps its current rect. */
export function openPanel(m: ModuleManifest, rect?: Rect): Promise<void> {
  const web = m.panel === "web" ? m.web : undefined;
  return openAt(m.id, web?.size ?? DEFAULT_SIZE, web, rect, web?.min);
}

export async function openAt(id: string, size: { w: number; h: number }, web?: WebConfig, rect?: Rect, min = MIN) {
  const cur = rect ?? (await getPanel(id).then((p) => p.rect, () => undefined));
  const screen = await mainClientRect();
  const r = clampToScreen(cur ?? cascade(opened++, screen, size), screen, min);
  await invoke("open_panel", { id, url: web?.url, profile: web?.profile, hosts: web?.hosts, rect: r });
  await commit(await getPanel(id));
}

/** A site (e.g. an embedded chat) as its own web panel; not a module, so not restored on startup. */
export const openWebPanel = (id: string, url: string, profile: string): Promise<void> =>
  openAt(id, { w: 460, h: 640 }, { url, profile }, undefined, { w: 320, h: 240 });

// Settings / Master Hub / YouTube pop-out player (hub.ytplayer) are NOT modules (never planets);
// opened explicitly. restore() ignores their saved rows (unknown id).
export const SETTINGS_ID = "hub.settings";
export const openSettings = (): Promise<void> => openAt(SETTINGS_ID, { w: 560, h: 520 });
export const MASTER_ID = "hub.master";
export const openMaster = (): Promise<void> => openAt(MASTER_ID, { w: 540, h: 600 });
export const YTPLAYER_ID = "hub.ytplayer"; export const openYtPlayer = (): Promise<void> => openAt(YTPLAYER_ID, { w: 480, h: 300 }, undefined, undefined, { w: 280, h: 180 });

// Row first: called from a chrome webview, close_panel destroys the caller
// before its reply arrives, so nothing after the invoke would run.
export async function closePanel(id: string): Promise<void> {
  const rect = await getPanel(id).then((p) => p.rect, () => undefined);
  await emit(PANEL_CLOSED, { id, rect }).catch(() => {});
  if (inChrome()) await emit(LAYOUT_DELETE, { id });
  else await deleteLayout(id);
  await invoke("close_panel", { id });
}

/** Raise (no-op in Rust if already top) and persist the authoritative z. */
export async function focusPanel(id: string, auto = false): Promise<SavedPanel> {
  const p = await invoke<SavedPanel>("focus_panel", { id });
  emit(PANEL_FOCUSED, { id, auto }).catch(() => {});
  await commit(p);
  return p;
}

/** Web panels: fill the main window client area, or restore the previous rect. */
export async function toggleFullWindow(id: string): Promise<boolean> {
  const [p, full] = await invoke<[SavedPanel, boolean]>("toggle_full_window", { id, screen: await mainClientRect() });
  await commit(p);
  return full;
}

/** Embedded site view inside panel `id` (Rust embed.rs): show this site's, hide the others. */
export const embedShow = (id: string, site: string, url: string, profile: string, hosts: string[]) =>
  invoke<void>("embed_show", { id, site, url, profile, hosts });
export const embedHide = (id: string) => invoke<void>("embed_hide", { id });

export const getPanel = (id: string) => invoke<SavedPanel>("get_panel", { id });

// During a pointer drag: invoke only, no persistence (commit on pointerup).
export const dragMove = (id: string, x: number, y: number) =>
  invoke<void>("move_panel", { id, x, y });
export const dragResize = (id: string, w: number, h: number) =>
  invoke<void>("resize_panel", { id, w, h });

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
  const rows = (await launchRows(known).catch(() => null)) ?? keepKnown(await loadLayout(), known.keys());
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

/** After maximise/restore/resize: pull every open panel back inside the usable area. */
export async function reclampPanels(): Promise<void> {
  const screen = await mainClientRect();
  const ids = [...registry.map((m) => [m.id, m.web?.min ?? MIN] as const), [SETTINGS_ID, MIN] as const, [MASTER_ID, MIN] as const, [YTPLAYER_ID, MIN] as const,
    ...Object.keys(DESK_SIZES).map((id) => [id, MIN] as const)];
  const open: { id: string; rect: Rect; min: { w: number; h: number } }[] = [];
  for (const [id, min] of ids) {
    const p = await getPanel(id).catch(() => null); // not open -> skip
    if (p) open.push({ id, rect: p.rect, min });
  }
  for (const { id, rect } of reclamp(open, screen)) {
    await dragResize(id, rect.w, rect.h);
    await dragMove(id, rect.x, rect.y);
    await commit(await getPanel(id));
  }
}
