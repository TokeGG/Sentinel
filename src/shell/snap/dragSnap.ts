// Tauri side of drag snapping (chrome/grip webviews): preview event to the main
// window while over an edge zone, place on release, neighbours follow a resize.
import { emit } from "@tauri-apps/api/event";
import { commit, dragMove, dragResize, getPanel, mainClientRect } from "../panelApi";
import { openPanels, snapAfterDrag } from "../desk/layoutOps";
import type { Rect } from "../layout";
import { resizeGroup, zoneRect, type Zone } from "./zones";
import { snapPrefsNow } from "./snapPrefs";
import { SNAP_ID } from "../desk/ids";

export const SNAP_PREVIEW = "snap-preview"; // payload { rect: Rect | null }
export const previewSnap = (rect: Rect | null) => emit(SNAP_PREVIEW, { rect }).catch(() => {});

export async function placeRect(id: string, r: Rect): Promise<void> {
  await dragResize(id, r.w, r.h);
  await dragMove(id, r.x, r.y);
  await commit(await getPanel(id));
}

/** End of a move drag: a zone places the panel there; else the old edge snap (if on). */
export async function finishMove(id: string, zone: Zone | null): Promise<void> {
  await previewSnap(null);
  const p = snapPrefsNow();
  if (!p.on) return;
  if (zone) return placeRect(id, zoneRect(zone, await mainClientRect(), p.gap));
  await snapAfterDrag(id).catch(() => {});
}

/** End of a resize drag: panels sharing a moved edge follow (snapped groups resize together). */
export async function finishResize(id: string, before: Rect): Promise<void> {
  const p = snapPrefsNow();
  if (!p.on) return;
  const after = (await getPanel(id)).rect;
  const all = (await openPanels()).filter((x) => x.id !== SNAP_ID);
  for (const n of resizeGroup(all, id, before, after, p.gap + 6)) await placeRect(n.id, n.rect);
}
