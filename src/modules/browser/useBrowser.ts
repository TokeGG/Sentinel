// Browser panel state: tab reducer (non-private tabs survive a panel re-create via
// localStorage), Rust tab webviews, page events, pending links from ui/openLink.
import { useEffect, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BROWSER_ID, BROWSER_OPEN, BROWSER_PENDING } from "../../ui/safeLink";
import { emptyTabs, persistable, restoreTabs, tabsReducer, type TabState } from "./tabs";
import { addHistory, setHistoryTitle } from "./store";

const KEY = "browser_tabs";
export type Download = { url: string; path: string | null; ok: boolean };
const load = (): TabState => { try { return restoreTabs(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return emptyTabs(); } };
const call = (cmd: string, args: Record<string, unknown>) => invoke(cmd, { id: BROWSER_ID, ...args });

export function useBrowser(onError: (e: unknown) => void, overlay: boolean) {
  const [s, dispatch] = useReducer(tabsReducer, undefined, load);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const ref = useRef(s);
  ref.current = s;
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(persistable(s))); } catch { /* storage off */ } }, [s]);

  // Show the active tab's webview unless a React page (manager, new-tab page) needs the area.
  const active = s.tabs.find((t) => t.id === s.active);
  useEffect(() => {
    if (!active || !active.url || overlay) { call("browser_hide", {}).catch(onError); return; }
    call("browser_show", { tab: active.id, url: active.url, private: active.private }).catch(onError);
  }, [active?.id, !!active?.url, overlay]);

  useEffect(() => {
    const drain = () => {
      let q: string[] = [];
      try { q = JSON.parse(localStorage.getItem(BROWSER_PENDING) ?? "[]"); localStorage.removeItem(BROWSER_PENDING); } catch { /* none */ }
      for (const url of Array.isArray(q) ? q : []) if (typeof url === "string") dispatch({ type: "open", url });
    };
    drain();
    const priv = (id: number) => ref.current.tabs.find((t) => t.id === id)?.private ?? true;
    const un = [
      listen(BROWSER_OPEN, drain),
      listen<{ url: string }>("browser-new-tab", ({ payload }) => dispatch({ type: "open", url: payload.url, private: priv(ref.current.active) && ref.current.active > 0 })),
      listen<{ tab: number; url: string }>("browser-nav", ({ payload: p }) => {
        dispatch({ type: "nav", id: p.tab, url: p.url });
        if (!priv(p.tab)) addHistory(p.url, ref.current.tabs.find((t) => t.id === p.tab)?.title ?? "").catch(() => {});
      }),
      listen<{ tab: number; title: string }>("browser-title", ({ payload: p }) => {
        dispatch({ type: "title", id: p.tab, title: p.title });
        const t = ref.current.tabs.find((x) => x.id === p.tab);
        if (t && !t.private) setHistoryTitle(t.url, p.title).catch(() => {});
      }),
      listen<Download>("browser-download", ({ payload }) => setDownloads((d) => [payload, ...d].slice(0, 100))),
    ];
    return () => un.forEach((p) => p.then((f) => f()));
  }, []);

  const go = (action: string, url?: string) => active && call("browser_go", { tab: active.id, action, url }).catch(onError);
  return {
    s, active, downloads,
    open: (url: string, priv = false) => dispatch({ type: "open", url, private: priv }),
    activate: (id: number) => dispatch({ type: "activate", id }),
    close: (id: number) => { dispatch({ type: "close", id }); call("browser_close_tab", { tab: id }).catch(onError); },
    navigate: (url: string) => {
      if (!active) return dispatch({ type: "open", url });
      const fresh = !active.url; // no webview yet: the show effect creates it at `url`
      dispatch({ type: "nav", id: active.id, url });
      if (!fresh) go("navigate", url);
    },
    back: () => go("back"), forward: () => go("forward"), reload: () => go("reload"),
  };
}
