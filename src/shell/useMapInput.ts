import { useRef, type RefObject } from "react";
import type { View } from "./mapLayout";
import { pinchScale, wheelScale, zoomAt } from "./viewMath";

type Pt = { x: number; y: number };
// Pointer input for the star map: one pointer pans, two pinch-zoom, wheel zooms,
// a press that never moved is a click. Planets are never dragged.
export function useMapInput(canvas: RefObject<HTMLCanvasElement | null>, view: RefObject<View>, redraw: () => void,
  cb: { hover(p: Pt | null): void; click(p: Pt): void; panning(): void }) {
  const ptrs = useRef(new Map<number, Pt>());
  const g = useRef({ moved: false, d0: 0, s0: 1 });
  const local = (e: { clientX: number; clientY: number }): Pt => {
    const b = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const two = (): [Pt, Pt] => { const [a, b] = [...ptrs.current.values()]; return [a, b]; };
  return {
    onPointerDown(e: React.PointerEvent) {
      ptrs.current.set(e.pointerId, local(e));
      canvas.current?.setPointerCapture?.(e.pointerId);
      if (ptrs.current.size === 1) g.current.moved = false;
      if (ptrs.current.size === 2) { const [a, b] = two(); g.current = { moved: true, d0: Math.hypot(a.x - b.x, a.y - b.y), s0: view.current.scale }; cb.panning(); }
    },
    onPointerMove(e: React.PointerEvent) {
      const p = local(e), prev = ptrs.current.get(e.pointerId);
      if (!prev) return cb.hover(p);
      ptrs.current.set(e.pointerId, p);
      const v = view.current;
      if (ptrs.current.size >= 2) {
        const [a, b] = two();
        zoomAt(v, (a.x + b.x) / 2, (a.y + b.y) / 2, pinchScale(g.current.s0, g.current.d0, Math.hypot(a.x - b.x, a.y - b.y)));
      } else {
        const dx = p.x - prev.x, dy = p.y - prev.y;
        if (!g.current.moved && Math.abs(dx) + Math.abs(dy) <= 2) return;
        g.current.moved = true;
        cb.panning();
        v.tx += dx;
        v.ty += dy;
      }
      redraw();
    },
    onPointerUp(e: React.PointerEvent) {
      const had = ptrs.current.delete(e.pointerId);
      if (had && ptrs.current.size === 0 && !g.current.moved) cb.click(local(e));
    },
    onPointerCancel(e: React.PointerEvent) { ptrs.current.delete(e.pointerId); },
    onPointerLeave() { if (ptrs.current.size === 0) cb.hover(null); },
    onWheel(e: React.WheelEvent) {
      const { x, y } = local(e);
      zoomAt(view.current, x, y, wheelScale(view.current.scale, e.deltaY));
      redraw();
    },
  };
}
