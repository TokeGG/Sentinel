import { useEffect, useRef } from "react";
import { useMotionPolicy } from "./useMotionPolicy";

// The star map's ONE frame scheduler: on-demand redraws (one rAF per input)
// plus a single ~30 fps rAF chain that runs only while shouldAnimate() holds
// (useMotionPolicy). Stars and orbits share it. `frame(dtMs)` gets 0 for a
// static/input redraw and the time since the last animated frame otherwise.
const FRAME_MS = 1000 / 30;

export function useMapLoop(frame: (dtMs: number) => void): () => void {
  const cb = useRef(frame);
  cb.current = frame;
  const loop = useRef<{ redraw: () => void; stop: () => void; set: (on: boolean) => void } | null>(null);
  if (!loop.current) {
    let raf = 0, timer = 0, animating = false, last = 0;
    // rAF timestamps are frame-start, too early to throttle on: use performance.now().
    const tick = () => {
      raf = 0;
      const now = performance.now();
      let dt = 0;
      if (animating) {
        if (last && now - last < FRAME_MS - 9) {
          raf = requestAnimationFrame(tick);
          return;
        }
        dt = last ? now - last : 0;
        last = now;
      }
      cb.current(dt);
      // Wait ~28 ms before the next rAF so the chain ticks at ~30/s, not 60/s.
      if (animating) timer = window.setTimeout(() => { timer = 0; raf = requestAnimationFrame(tick); }, 28);
    };
    const stop = () => { clearTimeout(timer); timer = 0; cancelAnimationFrame(raf); raf = 0; };
    const redraw = () => { if (!raf && !timer) raf = requestAnimationFrame(tick); };
    // Policy flip: stopped draws one static frame (current state), schedules nothing more;
    // a pause adds no time, motion resumes where it stopped.
    const set = (on: boolean) => { animating = on; stop(); last = 0; redraw(); };
    loop.current = { redraw, stop, set };
  }
  // Cleanup order matters: useMotionPolicy's cleanup calls set(false) (which queues a
  // static redraw); the effect below is declared after it, so its stop() runs last and cancels it.
  useMotionPolicy((on) => loop.current!.set(on));
  useEffect(() => () => loop.current!.stop(), []);
  return loop.current.redraw;
}
