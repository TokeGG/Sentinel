import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ModuleManifest } from "../core/module";
import { PLANET_BADGE, parsePlanetBadge, refreshBadges } from "./badges";
import { applyRefresh, setBadge } from "./badgeStore";
import { getMotion } from "./motionStore";

// Main window only. Badges refresh on mount, window focus and via the returned
// `onPanelClosed(id)` (App calls it from its layout-delete listener): never on a
// timer. Overlapping requests coalesce into one rerun. Web-panel counts arrive as
// `planet-badge` events and live in memory only; closing the panel zeroes them.
export function useBadges(registry: ModuleManifest[], onError: (m: string) => void): (id: string) => void {
  const refresh = useRef<() => void>(() => {});
  const closed = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    let alive = true, busy = false, again = false;
    const run = () => {
      if (busy) { again = true; return; }
      if (getMotion().gameMode) return; // no background work in game mode
      busy = true;
      refreshBadges(registry)
        .then((r) => { if (alive) applyRefresh(r); })
        .catch((e) => alive && onError(`Badges: ${String(e)}`))
        .finally(() => { busy = false; if (again && alive) { again = false; run(); } });
    };
    refresh.current = run;
    closed.current = (id) => {
      if (registry.some((m) => m.id === id && m.panel === "web")) setBadge(id, 0);
      run();
    };
    run();
    window.addEventListener("focus", run);
    const ids = registry.map((m) => m.id);
    const un = listen<unknown>(PLANET_BADGE, ({ payload }) => {
      const p = parsePlanetBadge(payload, ids);
      if (p) setBadge(p.id, p.count);
    });
    return () => {
      alive = false;
      window.removeEventListener("focus", run);
      un.then((f) => f());
    };
  }, []);
  return (id) => closed.current(id);
}
