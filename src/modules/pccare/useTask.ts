// Tiny async-call state for tool cards (PC Care, Home Network, GitHub): data, busy, error.
import { useCallback, useState } from "react";

export function useTask<T>() {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = useCallback(async (fn: () => Promise<T>) => {
    setBusy(true); setError(null);
    try { const v = await fn(); setData(v); return v; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return undefined; }
    finally { setBusy(false); }
  }, []);
  return { data, setData, busy, error, go };
}

export async function pickFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const d = await open({ directory: true, multiple: false });
  return typeof d === "string" ? d : null;
}
