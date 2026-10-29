// Tiny data hook for a panel tab: load() on mount, `act(fn)` runs a write, reloads, keeps the error.
import { useCallback, useEffect, useRef, useState } from "react";

export function useStore<T>(load: () => Promise<T>, init: T) {
  const [data, setData] = useState<T>(init);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => () => void (live.current = false), []);
  const reload = useCallback(async () => {
    try {
      const d = await loadRef.current();
      if (live.current) { setData(d); setError(null); }
    } catch (e) {
      if (live.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  const act = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true);
    try {
      const r = await fn();
      await reload();
      return r;
    } catch (e) {
      if (live.current) setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      if (live.current) setBusy(false);
    }
  }, [reload]);
  useEffect(() => void reload(), [reload]);
  return { data, error, busy, reload, act };
}
