import { useEffect, useMemo, useRef, useState } from "react";
import type { ModuleManifest } from "../core/module";
import { ensureSky, drawSky, prepCanvas, type Sky } from "./Sky";
import { buildSlots, fitView, makeScene, placeScene, stepScene, type Layers, type Scene, type View } from "./mapLayout";
import { hitTest, SUN } from "./mapHit";
import { backdrop, drawScene, type Sprites } from "./mapDraw";
import { getMotion, subscribeMotion } from "./motionStore";
import { subscribeBadges } from "./badgeStore";
import { noteFrame } from "./moonDraw";
import { useMapLoop } from "./useMapLoop";
import { openPanel, openSettings } from "./panelApi";

const LAYERS: Layers = { stars: true, orbit: true, speed: 1 }; // reused every frame

// Canvas solar-system map: night sky + orbiting planets, drawn by useMapLoop.
// The sun opens Settings; a planet opens its panel; drag pans, wheel zooms.
export function StarMap({ modules, onError }: { modules: ModuleManifest[]; onError: (m: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ tx: 0, ty: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const sky = useRef<Sky | null>(null);
  const prevScene = useRef<Scene | null>(null);
  const sprites = useRef<Sprites>({ planets: [] });
  const [hovering, setHovering] = useState(false);
  const scene = useMemo(() => {
    sprites.current.planets = [];
    return (prevScene.current = makeScene(buildSlots(modules), prevScene.current));
  }, [modules]);

  // Hover follows the pointer AND planets moving under a still pointer.
  const setHover = (i: number) => {
    if (i === scene.hover) return false;
    scene.hover = i;
    scene.hoverMs = 0; // the ~4 s hold (holdTarget) restarts per hover target
    setHovering(i !== -1);
    return true;
  };
  const hoverAt = (p: { x: number; y: number } | null) => setHover(p && !drag.current?.moved ? hitTest(scene, p.x, p.y, scene.r) : -1);

  const redraw = useMapLoop((dtMs) => {
    const prep = prepCanvas(canvas.current);
    if (!prep) return;
    const { ctx, w, h, dpr } = prep;
    noteFrame(dtMs);
    if (dtMs > 0) {
      const m = getMotion();
      LAYERS.stars = m.starMotion;
      LAYERS.orbit = m.orbitMotion;
      LAYERS.speed = m.orbitSpeed;
      stepScene(scene, dtMs, LAYERS);
    }
    placeScene(scene, view.current);
    if (dtMs > 0) hoverAt(pointer.current);
    const sk = (sky.current = ensureSky(sky.current, w, h, dpr));
    drawSky(ctx, sk, scene.starT, backdrop(sprites.current, sk, view.current));
    drawScene(ctx, scene, dpr, sprites.current);
  });

  // Badge changes and the Moons toggle repaint on demand (no timer).
  useEffect(() => {
    const a = subscribeBadges(redraw), b = subscribeMotion(redraw);
    return () => { a(); b(); };
  }, []);

  // Default view fits the whole system (outer ring + labels) on every resize.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      view.current = fitView(c.clientWidth, c.clientHeight);
      redraw();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    fit();
    return () => ro.disconnect();
  }, [scene]);

  const local = (e: React.MouseEvent | React.WheelEvent) => {
    const b = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const onMove = (e: React.MouseEvent) => {
    const p = (pointer.current = local(e));
    scene.idleMs = 0;
    const d = drag.current;
    if (d) {
      const dx = p.x - d.x, dy = p.y - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
      if (d.moved) setHover(-1); // a real drag drops hover; a click keeps it
      view.current.tx += dx;
      view.current.ty += dy;
      d.x = p.x;
      d.y = p.y;
      redraw();
      return;
    }
    placeScene(scene, view.current);
    if (hoverAt(p)) redraw();
  };
  const onUp = (e: React.MouseEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const p = local(e);
    placeScene(scene, view.current); // hit-test the planets where they are NOW
    const i = hitTest(scene, p.x, p.y, scene.r);
    if (i === SUN) openSettings().catch((err) => onError(`Open Settings: ${String(err)}`));
    const m = i >= 0 ? modules.find((x) => x.id === scene.slots[i].id) : undefined;
    if (m) openPanel(m).catch((err) => onError(`Open ${m.name}: ${String(err)}`));
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
          pointer.current = null;
          if (setHover(-1)) redraw();
        }}
        onWheel={onWheel}
      />
      {modules.length === 0 && <div className="starmap-empty">No modules installed yet.</div>}
    </>
  );
}
