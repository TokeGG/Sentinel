import { useEffect, useMemo, useRef, useState } from "react";
import type { ModuleManifest } from "../core/module";
import { ensureSky, drawSky, prepCanvas, type Sky } from "./Sky";
import { buildSlots, fitView, makeScene, stepScene, type Layers, type Scene, type View } from "./mapLayout";
import { placeScene, stepCam } from "./place3d";
import { hitTest, SUN } from "./mapHit";
import { drawScene, type Sprites } from "./mapDraw";
import { getMotion, subscribeMotion } from "./motionStore";
import { subscribeBadges } from "./badgeStore";
import { subscribeShown } from "./notifStore";
import { noteFrame } from "./moonDraw";
import { useMapLoop } from "./useMapLoop";
import { useMapInput } from "./useMapInput";
import { openMaster, openPanel } from "./panelApi";

const LAYERS: Layers = { stars: true, orbit: true, speed: 1 }; // reused every frame

// Canvas 3D solar system (tilted orbits, shaded planets, depth sorted, pointer parallax),
// drawn by useMapLoop. The sun opens the Master Hub; a planet opens its panel;
// drag pans, wheel/pinch zooms. Planets are not draggable.
export function StarMap({ modules, onError }: { modules: ModuleManifest[]; onError: (m: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ tx: 0, ty: 0, scale: 1 });
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const sky = useRef<Sky | null>(null);
  const prevScene = useRef<Scene | null>(null);
  const sprites = useRef<Sprites>({ planets: [] });
  const [hovering, setHovering] = useState(false);
  const scene = useMemo(() => {
    sprites.current.planets = [];
    return (prevScene.current = makeScene(buildSlots(modules), prevScene.current));
  }, [modules]);

  const setHover = (i: number) => {
    if (i === scene.hover) return false;
    scene.hover = i;
    scene.hoverMs = 0; // the ~4 s hold (holdTarget) restarts per hover target
    setHovering(i !== -1);
    return true;
  };
  const hoverAt = (p: { x: number; y: number } | null) => setHover(p ? hitTest(scene, p.x, p.y) : -1);

  const redraw = useMapLoop((dtMs) => {
    const prep = prepCanvas(canvas.current);
    if (!prep) return;
    const { ctx, w, h, dpr } = prep;
    size.current = { w, h };
    noteFrame(dtMs);
    if (dtMs > 0) {
      const m = getMotion();
      LAYERS.stars = m.starMotion;
      LAYERS.orbit = m.orbitMotion;
      LAYERS.speed = m.orbitSpeed;
      stepScene(scene, dtMs, LAYERS);
      stepCam(scene, dtMs);
    }
    placeScene(scene, view.current);
    if (dtMs > 0) hoverAt(pointer.current);
    const sk = (sky.current = ensureSky(sky.current, w, h, dpr));
    drawSky(ctx, sk, scene.starT);
    drawScene(ctx, scene, view.current, dpr, sprites.current, w, h);
  });

  // Badge/prefs changes and the Moons toggle repaint on demand (no timer).
  useEffect(() => {
    const a = subscribeBadges(redraw), b = subscribeMotion(redraw), c = subscribeShown(redraw);
    return () => { a(); b(); c(); };
  }, []);

  // Default view fits the whole system on every resize.
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

  const input = useMapInput(canvas, view, redraw, {
    hover(p) {
      pointer.current = p;
      scene.idleMs = 0;
      scene.px = p ? (p.x / size.current.w - 0.5) * 2 : 0;
      scene.py = p ? (p.y / size.current.h - 0.5) * 2 : 0;
      placeScene(scene, view.current);
      if (hoverAt(p)) redraw();
    },
    panning() { pointer.current = null; setHover(-1); },
    click(p) {
      placeScene(scene, view.current); // hit-test the bodies where they are NOW
      const i = hitTest(scene, p.x, p.y);
      if (i === SUN) openMaster().catch((err) => onError(`Open Master Hub: ${String(err)}`));
      const m = i >= 0 ? modules.find((x) => x.id === scene.slots[i].id) : undefined;
      if (m) openPanel(m).catch((err) => onError(`Open ${m.name}: ${String(err)}`));
    },
  });

  return (
    <>
      <canvas ref={canvas} className={hovering ? "hovering" : ""} aria-label="Module star map" {...input} />
      {modules.length === 0 && <div className="starmap-empty">No modules installed yet.</div>}
    </>
  );
}
