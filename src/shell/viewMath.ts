// Pure pan/zoom math for the map (planets are not draggable: drag pans, wheel/pinch zooms).
import type { View } from "./mapLayout.ts";

export const ZOOM_MIN = 0.2, ZOOM_MAX = 4;
export const clampZoom = (s: number): number => (Number.isFinite(s) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s)) : 1);

/** Zoom to `next` keeping the world point under screen (x, y) fixed. Mutates and returns v. */
export function zoomAt(v: View, x: number, y: number, next: number): View {
  const s = clampZoom(next);
  v.tx = x - ((x - v.tx) * s) / v.scale;
  v.ty = y - ((y - v.ty) * s) / v.scale;
  v.scale = s;
  return v;
}
export const wheelScale = (scale: number, deltaY: number): number => scale * Math.exp(-deltaY * 0.0015);
/** Pinch: scale at gesture start x (current finger distance / start distance). */
export const pinchScale = (start: number, d0: number, d: number): number => (d0 > 0 ? start * (d / d0) : start);
