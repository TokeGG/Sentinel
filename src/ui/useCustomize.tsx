// Saved views for one panel: load, switch, create, delete and edit. Every view
// that reaches state passes through mergeView (sanitized against the
// manifest's customize declaration); writes are serialized so a fast slider
// drag can't land out of order. Section contract: see ./Section.tsx.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModuleManifest } from "../core/module";
import { cssVars, defaultView, mergeView, type View } from "./prefs";
import { deleteView, loadViews, saveView, setActiveView } from "./prefsStore";
import { errorText } from "./moduleRun";

export { PanelContext, Section, Sections, useSections } from "./Section";

export type Customize = {
  view: View;
  views: string[];
  setView(v: View): Promise<void>;
  switchTo(name: string): Promise<void>;
  create(name: string): Promise<void>;
  remove(name: string): Promise<void>;
  vars: Record<string, string>;
  /** Additive: false until the saved views have loaded (or failed to). */
  ready: boolean;
  /** Additive: last load/save failure, shown by PanelRoute. */
  error: string | null;
};

export function useCustomize(m: ModuleManifest): Customize {
  const c = m.customize;
  const base = useMemo<Partial<View> | undefined>(() => (m.accent ? { accent: m.accent } : undefined), [m.accent]);
  const [all, setAll] = useState<View[]>(() => [defaultView(c, undefined, base)]);
  const [active, setActive] = useState("Default");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Runs DB work one at a time; a failure is recorded (shown by PanelRoute),
  // never thrown, so callers need no catch.
  const write = useCallback((fn: () => Promise<unknown>): Promise<void> => {
    const p = queue.current.then(fn).then(
      () => {},
      (e) => setError(errorText(e))
    );
    queue.current = p;
    return p;
  }, []);

  const reload = useCallback(async () => {
    const r = await loadViews(m.id, c, base);
    setAll(r.views);
    setActive(r.active);
    setError(null);
  }, [m.id, c, base]);

  useEffect(() => {
    let live = true;
    write(reload).then(() => live && setReady(true));
    return () => void (live = false);
  }, [reload, write]);

  const view = all.find((v) => v.name === active) ?? all[0];

  const setView = useCallback(
    async (v: View) => {
      const clean = { ...mergeView(v, c), name: view.name };
      setAll((xs) => xs.map((x) => (x.name === clean.name ? clean : x)));
      await write(() => saveView(m.id, clean));
    },
    [c, m.id, view.name, write]
  );

  const switchTo = useCallback(
    async (name: string) => {
      if (!all.some((v) => v.name === name)) return;
      setActive(name);
      await write(() => setActiveView(m.id, name));
    },
    [all, m.id, write]
  );

  const create = useCallback(
    async (name: string) => {
      const fresh = mergeView({ ...view, name }, c);
      if (!name.trim() || all.some((v) => v.name === fresh.name)) {
        setError(`a view named "${name.trim()}" already exists or the name is empty`);
        return;
      }
      await write(async () => {
        await saveView(m.id, fresh);
        await setActiveView(m.id, fresh.name);
        await reload();
      });
    },
    [all, c, m.id, reload, view, write]
  );

  const remove = useCallback(
    async (name: string) => {
      if (all.length <= 1) return;
      await write(async () => {
        await deleteView(m.id, name);
        await reload();
      });
    },
    [all.length, m.id, reload, write]
  );

  const vars = useMemo(() => cssVars(view), [view]);
  const views = useMemo(() => all.map((v) => v.name), [all]);
  return { view, views, setView, switchTo, create, remove, vars, ready, error };
}
