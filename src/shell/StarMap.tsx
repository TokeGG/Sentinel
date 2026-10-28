import { useEffect, useMemo, useRef, useState } from "react";
import type { ModuleManifest } from "../core/module";
import { planetsFor, type PlanetPos } from "./planets";
import { drawPlanet, drawStars } from "./Planet";
import { openPanel } from "./panelApi";

type View = { tx: number; ty: number; scale: number };
const WORLD = { w: 1600, h: 1000 };

// Canvas star map. Redraws are on demand (one rAF per input event), never a
// continuous frame loop, so an idle hub costs nothing while gaming.
export function StarMap({ modules, onError }: { modules: ModuleManifest[]; onError: (m: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ tx: 0, ty: 0, scale: 1 });
  const hover = useRef<string | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const frame = useRef(0);
  const [hovering, setHovering] = useState(false);
  const planets = useMemo(() => planetsFor(modules, WORLD), [modules]);
  const names = useMemo(() => new Map(modules.map((m) => [m.id, m.name])), [modules]);

  const draw = () => {
    frame.current = 0;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawStars(ctx, w, h);
    const v = view.current;
    ctx.translate(v.tx, v.ty);
    ctx.scale(v.scale, v.scale);
    for (const p of planets) drawPlanet(ctx, p, names.get(p.id) ?? p.id, p.id === hover.current);
  };
  const redraw = () => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  };

  // Fit the world box into the canvas whenever it resizes.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      // Margin keeps labels and the HUD clear of edge planets.
      const s = Math.min((c.clientWidth - 80) / WORLD.w, (c.clientHeight - 150) / WORLD.h) || 1;
      view.current = { scale: s, tx: (c.clientWidth - WORLD.w * s) / 2, ty: (c.clientHeight - WORLD.h * s) / 2 + 20 };
      redraw();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    fit();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [planets]);

  const hit = (cx: number, cy: number): PlanetPos | undefined => {
    const v = view.current;
    const wx = (cx - v.tx) / v.scale, wy = (cy - v.ty) / v.scale;
    return planets.find((p) => Math.hypot(p.x - wx, p.y - wy) <= p.r + 4 / v.scale);
  };
  const local = (e: React.MouseEvent | React.WheelEvent) => {
    const b = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  const onMove = (e: React.MouseEvent) => {
    const { x, y } = local(e);
    if (drag.current) {
      const dx = x - drag.current.x, dy = y - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
      view.current.tx += dx;
      view.current.ty += dy;
      drag.current.x = x;
      drag.current.y = y;
      redraw();
      return;
    }
    const id = hit(x, y)?.id ?? null;
    if (id !== hover.current) {
      hover.current = id;
      setHovering(id !== null);
      redraw();
    }
  };
  const onUp = (e: React.MouseEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const p = hit(local(e).x, local(e).y);
      const m = p && modules.find((x) => x.id === p.id);
      if (m) openPanel(m).catch((err) => onError(`Open ${m.name}: ${String(err)}`));
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    const { x, y } = local(e);
    const v = view.current;
    const next = Math.min(4, Math.max(0.2, v.scale * Math.exp(-e.deltaY * 0.0015)));
    v.tx = x - ((x - v.tx) * next) / v.scale;
    v.ty = y - ((y - v.ty) * next) / v.scale;
    v.scale = next;
    redraw();
  };

  return (
    <>
      <canvas
        ref={canvas}
        className={hovering ? "hovering" : ""}
        aria-label="Module star map"
        onMouseDown={(e) => (drag.current = { ...local(e), moved: false })}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={() => {
          drag.current = null;
          if (hover.current) { hover.current = null; setHovering(false); redraw(); }
        }}
        onWheel={onWheel}
      />
      {modules.length === 0 && <div className="starmap-empty">No modules installed yet.</div>}
    </>
  );
}
