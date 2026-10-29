import { useRef, type RefObject } from "react";
import type { View } from "./mapLayout";
import { pinchScale, wheelScale, zoomAt } from "./viewMath";
import { isDrag } from "./planetDrag";

type Pt = { x: number; y: number };
// Pointer input for the star map: the world never pans or follows the mouse.
// One pointer on a planet drags it (drop -> cb.drop); a press that moved < DRAG_PX
// is a click; two pointers pinch-zoom and the wheel zooms, both about the canvas centre.
export function useMapInput(canvas: RefObject<HTMLCanvasElement | null>, view: RefObject<View>, redraw: () => void,
  cb: { hover(p: Pt | null): void; click(p: Pt): void; pick(p: Pt): number; drag(i: number, p: Pt): void; drop(i: number, p: Pt): void; cancel(): void }) {
  const ptrs = useRef(new Map<number, Pt>());
  const g = useRef({ start: { x: 0, y: 0 }, moved: false, planet: -1, d0: 0, s0: 1 });
  const local = (e: { clientX: number; clientY: number }): Pt => {
    const b = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const centre = (): Pt => ({ x: (canvas.current?.clientWidth ?? 0) / 2, y: (canvas.current?.clientHeight ?? 0) / 2 });
  const two = (): [Pt, Pt] => { const [a, b] = [...ptrs.current.values()]; return [a, b]; };
  return {
    onPointerDown(e: React.PointerEvent) {
      const p = local(e);
      ptrs.current.set(e.pointerId, p);
      canvas.current?.setPointerCapture?.(e.pointerId);
      if (ptrs.current.size === 1) g.current = { ...g.current, start: p, moved: false, planet: cb.pick(p) };
      if (ptrs.current.size === 2) {
        const [a, b] = two();
        if (g.current.planet >= 0 && g.current.moved) cb.cancel();
        g.current = { ...g.current, moved: true, planet: -1, d0: Math.hypot(a.x - b.x, a.y - b.y), s0: view.current.scale };
      }
    },
    onPointerMove(e: React.PointerEvent) {
      const p = local(e);
      if (!ptrs.current.has(e.pointerId)) return cb.hover(p);
      ptrs.current.set(e.pointerId, p);
      if (ptrs.current.size >= 2) {
        const [a, b] = two(), c = centre();
        zoomAt(view.current, c.x, c.y, pinchScale(g.current.s0, g.current.d0, Math.hypot(a.x - b.x, a.y - b.y)));
        return redraw();
      }
      if (!g.current.moved && !isDrag(p.x - g.current.start.x, p.y - g.current.start.y)) return;
      g.current.moved = true;
      if (g.current.planet >= 0) { cb.drag(g.current.planet, p); redraw(); }
    },
    onPointerUp(e: React.PointerEvent) {
      const p = local(e), had = ptrs.current.delete(e.pointerId);
      if (!had || ptrs.current.size !== 0) return;
      if (!g.current.moved) cb.click(p);
      else if (g.current.planet >= 0) cb.drop(g.current.planet, p);
      g.current.planet = -1;
    },
    onPointerCancel(e: React.PointerEvent) {
      ptrs.current.delete(e.pointerId);
      if (g.current.planet >= 0 && g.current.moved) cb.cancel();
      g.current.planet = -1;
    },
    onPointerLeave() { if (ptrs.current.size === 0) cb.hover(null); },
    onWheel(e: React.WheelEvent) {
      const c = centre();
      zoomAt(view.current, c.x, c.y, wheelScale(view.current.scale, e.deltaY));
      redraw();
    },
  };
}
