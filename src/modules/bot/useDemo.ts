// Teach-by-demo: opens the bot browser VISIBLE, records the user's clicks and typing through driver.js
// (recStart/recTake/recStop; password fields never recorded) until Stop. Polls only while recording.
import { useCallback, useEffect, useRef, useState } from "react";
import { getSetting } from "../skills/store";
import { readEvents, type DemoEvent } from "./demo";
import { openBrowserDriver } from "./driver";
import { BUSY_KEY, busyHeld } from "./jobs";
import { loadLearnState } from "./store";
import { bestVariant } from "./kernel/variants";

type Drv = Awaited<ReturnType<typeof openBrowserDriver>>;

export function useDemo() {
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [recording, setRec] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drv = useRef<Drv | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const take = async (js: string) => { const v = await drv.current?.exec(js); setEvents((e) => [...e, ...readEvents(v)].slice(-500)); };
  const end = useCallback(async () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (drv.current) { await take("window.__sb.recStop()").catch(() => {}); await drv.current.close(); drv.current = null; }
    setRec(false);
  }, []);
  useEffect(() => () => void end(), [end]); // closing the panel stops recording
  const start = useCallback(async (url: string) => {
    setError(null); setEvents([]);
    try {
      if (busyHeld(await getSetting(BUSY_KEY), Date.now())) throw new Error("The bot is busy with a run.");
      drv.current = await openBrowserDriver({ brain: bestVariant((await loadLearnState()).pop).brain, visible: true, startUrl: url || undefined, onStopped: () => void end() });
      await drv.current.exec("window.__sb.recStart()");
      setRec(true);
      timer.current = setInterval(() => void take("window.__sb.recTake(true)").catch(() => {}), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); await end(); }
  }, [end]);
  return { events, recording, error, start, stop: end, clear: () => setEvents([]) };
}
