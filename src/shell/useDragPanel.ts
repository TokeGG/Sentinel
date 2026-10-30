// Pointer drag for a panel's chrome strip (move) and corner grip (resize).
// Moves are coalesced to one IPC per animation frame; nothing is persisted or
// raised until the drag ends (raising re-creates the webviews, which would kill
// the element holding the pointer capture).
import { useRef, useState } from "react";
import { dragRect, resizeRect, type Rect } from "./layout";
import { finishMove, finishResize, previewSnap } from "./snap/dragSnap";
import { edgeZone, zoneRect, type Zone } from "./snap/zones";
import { snapPrefsNow } from "./snap/snapPrefs";
import { lockedNow } from "./desk/usePanelView";
import { commit, dragMove, dragResize, focusPanel, getPanel, mainClientRect, MIN } from "./panelApi";

export type Kind = "move" | "resize";
type Drag = { sx: number; sy: number; ox: number; oy: number; start: Rect; screen: Rect; dx: number; dy: number; raf: number; zone: Zone | null };

export function useDragPanel(id: string, kind: Kind, min = MIN) {
  const drag = useRef<Drag | null>(null);
  const armed = useRef(false); // a gesture started on the bar (not on a button)
  const press = useRef(0); // bumps on every down/up so a late start reply is dropped
  const [err, setErr] = useState<string | null>(null);
  const fail = (what: string) => (e: unknown) => {
    console.error(what, e);
    setErr(`${what}: ${String(e)}`);
  };

  const flush = () => {
    const d = drag.current;
    if (!d) return;
    d.raf = 0;
    if (kind === "move") {
      const r = dragRect(d.start, d.dx, d.dy, d.screen, min);
      dragMove(id, r.x, r.y).catch(fail("drag"));
      // Pointer in main-client px: the chrome strip sits at the panel's top-left.
      const pr = snapPrefsNow();
      const z = pr.on ? edgeZone({ x: d.start.x + d.ox + d.dx, y: d.start.y + d.oy + d.dy }, d.screen) : null;
      if (z !== d.zone) { d.zone = z; previewSnap(z ? zoneRect(z, d.screen, pr.gap) : null); }
    } else {
      const r = resizeRect(d.start, d.dx, d.dy, d.screen, min);
      dragResize(id, r.w, r.h).catch(fail("drag"));
    }
  };

  const down = async (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    armed.current = true;
    setErr(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    const { screenX: sx, screenY: sy, clientX: ox, clientY: oy } = e;
    drag.current = null;
    const my = ++press.current;
    try {
      const [p, screen, locked] = await Promise.all([getPanel(id), mainClientRect(), lockedNow(id)]);
      if (my !== press.current || locked) return; // released early, or panel lock (Settings > Panels)
      drag.current = { sx, sy, ox, oy, start: p.rect, screen, dx: 0, dy: 0, raf: 0, zone: null };
    } catch (x) {
      fail("drag")(x);
    }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.dx = e.screenX - d.sx;
    d.dy = e.screenY - d.sy;
    if (!d.raf) d.raf = requestAnimationFrame(flush); // no loop when idle
  };
  const up = async () => {
    if (!armed.current) return;
    armed.current = false;
    press.current++;
    const d = drag.current;
    drag.current = null;
    try {
      if (d) {
        if (d.raf) cancelAnimationFrame(d.raf);
        drag.current = d;
        flush();
        drag.current = null;
        if (kind === "move") await finishMove(id, d.zone); // zone place or edge snap
        else await finishResize(id, d.start).catch(() => {}); // neighbours follow
        await commit(await getPanel(id)); // persist once, at drag end
      }
      await focusPanel(id); // raise last: may re-create (and so destroy) this webview
    } catch (x) {
      fail("save")(x);
    }
  };
  return { err, fail, handlers: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } };
}
