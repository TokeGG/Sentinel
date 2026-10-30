// Panel webview side of panel view prefs: applies zoom/opacity to the body,
// Ctrl+=/-/0 zoom (saved per module), remembers scroll in localStorage.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSetting, setSetting } from "../../ui/appSetting";
import { DESK_CHANGED } from "./store";
import { DEFAULT_VIEW, sanitizeViews, stepZoom, viewOf, type PanelView, type PanelViews } from "./panelView";

const json = (v: string | null): unknown => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
export const getViews = async (): Promise<PanelViews> => sanitizeViews(json(await getSetting("panel_view_prefs")));
export async function setView(id: string, v: PanelView): Promise<void> {
  const all = await getViews();
  await setSetting("panel_view_prefs", JSON.stringify({ ...all, [id]: v }));
}
export const lockedNow = async (id: string): Promise<boolean> => viewOf(await getViews(), id).lock;

export function usePanelView(id: string): PanelView {
  const [v, setV] = useState<PanelView>(DEFAULT_VIEW);
  useEffect(() => {
    let cur = DEFAULT_VIEW;
    const load = () => getViews().then((a) => { cur = viewOf(a, id); setV(cur); }).catch(() => {});
    load();
    const un = listen(DESK_CHANGED, load);
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const dir = e.key === "=" || e.key === "+" ? 1 : e.key === "-" ? -1 : e.key === "0" ? 0 : null;
      if (dir === null) return;
      e.preventDefault();
      cur = { ...cur, zoom: stepZoom(cur.zoom, dir) };
      setV(cur);
      setView(id, cur).catch(() => {});
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); un.then((f) => f()); };
  }, [id]);
  useEffect(() => {
    if (!v.keepScroll) return;
    const k = `scroll:${id}`;
    const el = document.scrollingElement ?? document.documentElement;
    try { const y = Number(localStorage.getItem(k)); if (y > 0) setTimeout(() => el.scrollTo(0, y), 300); } catch { /* storage off */ }
    let t: ReturnType<typeof setTimeout> | null = null;
    const on = () => { if (t) clearTimeout(t); t = setTimeout(() => { try { localStorage.setItem(k, String(Math.round(el.scrollTop))); } catch { /* off */ } }, 250); };
    window.addEventListener("scroll", on, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", on, { capture: true });
  }, [id, v.keepScroll]);
  return v;
}
