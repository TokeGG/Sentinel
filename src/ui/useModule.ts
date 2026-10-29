// Data hook for a panel body: rows from manifest.load(), skill runs with busy
// and error state, and the view's refresh interval. The interval (default off)
// runs only while the panel is mounted and the document is visible; it is
// cleared on unmount. updated/error are reported up to PanelRoute's StatusLine.
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ModuleManifest } from "../core/module";
import { errorText, findSkill, intervalMs } from "./moduleRun";
import { PanelContext } from "./Section";

export type ModuleRow = Record<string, unknown>;
export type ModuleState = {
  rows: ModuleRow[];
  busy: boolean;
  error: string | null;
  updated: Date | null;
  refresh(): Promise<void>;
  run(skill: string, args?: Record<string, unknown>): Promise<unknown>;
};

export function useModule(m: ModuleManifest): ModuleState {
  return useModuleCore(m);
}

/** useModule plus `exec(fn)` for the generic panel, whose parts hold closures. */
export function useModuleCore(m: ModuleManifest) {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const { view, onStatus } = useContext(PanelContext);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => void (live.current = false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = m.load ? await m.load() : [];
      if (!live.current) return;
      setRows(r);
      setUpdated(new Date());
      setError(null);
    } catch (e) {
      if (live.current) setError(errorText(e));
    }
  }, [m]);

  // Busy -> work -> reload -> idle; a failure is stored, never thrown.
  const exec = useCallback(
    async (fn: () => Promise<unknown>): Promise<unknown> => {
      setBusy(true);
      setError(null);
      try {
        const out = await fn();
        await refresh();
        return out;
      } catch (e) {
        if (live.current) setError(errorText(e));
        return undefined;
      } finally {
        if (live.current) setBusy(false);
      }
    },
    [refresh]
  );
  const run = useCallback(
    (skill: string, args?: Record<string, unknown>) => exec(() => findSkill(m, skill).run(args)),
    [m, exec]
  );

  useEffect(() => void refresh(), [refresh]);

  const ms = intervalMs(view?.refreshMinutes ?? null);
  useEffect(() => {
    if (ms === null) return;
    let t: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (t !== undefined) clearInterval(t);
      t = undefined;
    };
    const sync = () => {
      if (document.visibilityState !== "visible") stop();
      else if (t === undefined) t = setInterval(() => void refresh(), ms);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ms, refresh]);

  useEffect(() => onStatus?.({ updated, error }), [updated, error, onStatus]);

  return { rows, busy, error, updated, refresh, run, exec };
}
