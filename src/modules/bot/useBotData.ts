// Notes and the learning state for the Knowledge and Brain sections; reload() after any change.
import { useCallback, useEffect, useState } from "react";
import type { Note } from "./knowledge";
import type { LearnState } from "./learn";
import { allNotes, loadLearnState } from "./store";

export function useBotData() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [state, setState] = useState<LearnState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try { setNotes(await allNotes()); setState(await loadLearnState()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => void reload(), [reload]);
  return { notes, state, error, reload };
}
