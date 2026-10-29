// Main-window panel operations over the Rust panel manager: open by id, list
// open panels, named layouts, tiling, focus mode, pins, next monitor.
import { invoke } from "@tauri-apps/api/core";
import { availableMonitors, getCurrentWindow } from "@tauri-apps/api/window";
import { registry } from "../../core/module";
import { closePanel, commit, dragMove, dragResize, focusPanel, getPanel, mainClientRect, MASTER_ID, openAt, openMaster, openPanel, openSettings, reclampPanels, SETTINGS_ID } from "../panelApi";
import type { Rect } from "../layout";
import { DESK_SIZES } from "./ids";
import { cleanName, switchPlan, type LayoutPanel } from "./namedLayouts";
import { nextMonitor, snapRect, tileRects, type TilePreset } from "./snap";
import { getLayouts, getPins, setLayouts, setPins } from "./store";

export const specialIds = () => [SETTINGS_ID, MASTER_ID, ...Object.keys(DESK_SIZES)];
export const allIds = () => [...registry.map((m) => m.id), ...specialIds()];
export const isKnown = (id: string) => allIds().includes(id);

export function openById(id: string, rect?: Rect): Promise<void> {
  const m = registry.find((x) => x.id === id);
  if (m) return openPanel(m, rect);
  if (id === SETTINGS_ID && !rect) return openSettings();
  if (id === MASTER_ID && !rect) return openMaster();
  return openAt(id, DESK_SIZES[id] ?? { w: 560, h: 520 }, undefined, rect);
}

/** Open panels (module + special) with their rects, lowest z first. */
export async function openPanels(): Promise<{ id: string; rect: Rect; z: number }[]> {
  const out = await Promise.all(allIds().map((id) => getPanel(id).then((p) => (p.state === "open" ? p : null), () => null)));
  return out.filter((p): p is NonNullable<typeof p> => !!p).sort((a, b) => a.z - b.z);
}

export async function saveNamedLayout(name: string): Promise<void> {
  const n = cleanName(name);
  if (!n) throw new Error("layout name: 1-32 letters, digits, spaces or dashes");
  const panels: LayoutPanel[] = (await openPanels()).filter((p) => registry.some((m) => m.id === p.id)).map((p) => ({ id: p.id, rect: p.rect }));
  await setLayouts({ ...(await getLayouts()), [n]: panels });
}

export async function switchLayout(name: string): Promise<void> {
  const target = (await getLayouts())[name];
  if (!target) throw new Error(`no saved layout "${name}"`);
  const open = (await openPanels()).map((p) => p.id).filter((id) => registry.some((m) => m.id === id));
  const plan = switchPlan(open, target, (id) => registry.some((m) => m.id === id));
  for (const id of plan.close) await closePanel(id);
  for (const p of plan.open) await openById(p.id, p.rect);
}

export async function tileAll(preset: TilePreset): Promise<void> {
  const open = await openPanels();
  const rects = tileRects(preset, open.length, await mainClientRect());
  for (let i = 0; i < open.length; i++) {
    await dragResize(open[i].id, rects[i].w, rects[i].h);
    await dragMove(open[i].id, rects[i].x, rects[i].y);
    await commit(await getPanel(open[i].id));
  }
}

// Focus mode: other panels are closed WITHOUT forgetting their layout row and
// reopened at the same rect on exit (Rust has no hide; close + reopen is the
// same mechanism raising already uses).
let hidden: { id: string; rect: Rect }[] | null = null;
export const inFocusMode = () => hidden !== null;
export async function toggleFocusMode(keep: string | null): Promise<boolean> {
  if (hidden) {
    const back = hidden;
    hidden = null;
    for (const p of back) await openById(p.id, p.rect).catch(() => {});
    if (keep) await focusPanel(keep).catch(() => {});
    return false;
  }
  const others = (await openPanels()).filter((p) => p.id !== keep);
  hidden = others.map((p) => ({ id: p.id, rect: p.rect }));
  for (const p of others) await invoke("close_panel", { id: p.id }).catch(() => {});
  return true;
}

/** Pin = keep above other panels: re-raised after another panel is focused (best effort). */
export async function togglePin(id: string): Promise<boolean> {
  const pins = await getPins();
  const on = !pins.includes(id);
  await setPins(on ? [...pins, id] : pins.filter((p) => p !== id));
  if (on) await focusPanel(id, true);
  return on;
}
export async function raisePins(except: string): Promise<void> {
  for (const id of await getPins()) {
    if (id === except) continue;
    const p = await getPanel(id).catch(() => null);
    if (p?.state === "open") await focusPanel(id, true).catch(() => {});
  }
}

/** Move the whole Sentinel window to the next monitor and maximise it there. */
export async function moveToNextMonitor(): Promise<void> {
  const w = getCurrentWindow();
  const mons = await availableMonitors();
  const pos = await w.outerPosition();
  const i = nextMonitor(mons, { x: pos.x + 10, y: pos.y + 10 });
  if (i < 0) return;
  await w.unmaximize().catch(() => {});
  await w.setPosition(mons[i].position);
  await w.maximize();
  await reclampPanels();
}

/** After a move drag: snap to screen/panel edges when within SNAP_PX. */
export async function snapAfterDrag(id: string): Promise<void> {
  const [me, all, screen] = await Promise.all([getPanel(id), openPanels(), mainClientRect()]);
  const r = snapRect(me.rect, screen, all.filter((p) => p.id !== id).map((p) => p.rect));
  if (r.x !== me.rect.x || r.y !== me.rect.y) await dragMove(id, r.x, r.y);
}
