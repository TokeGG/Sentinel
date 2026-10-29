import { useEffect, useRef } from "react";
import { shouldAnimate } from "./motionPolicy";
import { anyMotion, getMotion, subscribeMotion } from "./motionStore";

// Calls onChange(on) whenever shouldAnimate() flips (visibility, game mode,
// reduced-motion media query, star or orbit motion setting). Fires once on mount only
// if the answer is true; `false` is the initial assumed state.
export function useMotionPolicy(onChange: (on: boolean) => void) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cur = false;
    const sync = () => {
      const on = shouldAnimate({
        visible: document.visibilityState === "visible",
        gameMode: getMotion().gameMode,
        reducedMotion: mq.matches && !getMotion().ignoreReduced,
        motionOn: anyMotion(),
      });
      if (on === cur) return;
      cur = on;
      cb.current(on);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    mq.addEventListener("change", sync);
    const un = subscribeMotion(sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      mq.removeEventListener("change", sync);
      un();
      cb.current(false);
    };
  }, []);
}
