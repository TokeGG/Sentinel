// React hook over the taste store: profile, marks (latest like/dislike/hide per
// item), and ordering. Everything stays local; failures degrade to "no taste".
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyProfile, type Profile, type Ranked, type Signal, type TasteItem } from "./model.ts";
import { mulberry32 } from "./rng.ts";
import { isHiddenMark, orderItems, withMark, type Marks } from "./order.ts";
import * as store from "./store.ts";

export type Taste = ReturnType<typeof useTaste>;

export function useTaste(moduleId: string) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [marks, setMarks] = useState<Marks>({});
  const [off, setOffState] = useState(false);
  const [ready, setReady] = useState(false);
  const seed = useRef(Date.now()); // one seed per mount: exploration does not reshuffle on every render

  useEffect(() => {
    let live = true;
    Promise.all([store.loadProfile(moduleId), store.loadMarks(moduleId), store.isOff(moduleId)])
      .then(([p, m, o]) => live && (setProfile(p), setMarks(m), setOffState(o)))
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => void (live = false);
  }, [moduleId]);

  const record = useCallback(async (item: TasteItem, signal: Signal) => {
    try {
      const next = await store.recordSignal(moduleId, item.key, item.features, signal);
      if (next) setProfile(next);
      if (next && signal !== "open" && signal !== "finish") setMarks((m) => withMark(m, item.key, signal));
    } catch { /* taste is optional */ }
  }, [moduleId]);

  const order = useCallback(<T,>(rows: T[], toItem: (r: T) => TasteItem, forYou: boolean): Ranked<T>[] =>
    orderItems(rows, toItem, profile, marks, { forYou, off, rng: mulberry32(seed.current) }), [profile, marks, off]);

  const forget = useCallback(async (f: string) => setProfile(await store.forget(moduleId, f)), [moduleId]);
  const reset = useCallback(async () => { await store.resetTaste(moduleId); setProfile(emptyProfile()); setMarks({}); }, [moduleId]);
  const setOff = useCallback(async (v: boolean) => { await store.setOff(moduleId, v); setOffState(v); }, [moduleId]);

  return useMemo(() => ({ moduleId, profile, marks, off, ready, record, order, forget, reset, setOff, isHidden: (k: string) => isHiddenMark(marks[k]) }),
    [moduleId, profile, marks, off, ready, record, order, forget, reset, setOff]);
}
