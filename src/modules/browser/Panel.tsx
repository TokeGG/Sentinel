// hub.browser panel: fixed toolbar band (BROWSER_TOP) + web-app sidebar (BROWSER_LEFT);
// the page area below/right of them is the active tab's Rust webview. React pages
// (bookmarks, history, downloads, settings, new tab) hide the webview while shown.
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ModuleManifest } from "../../core/module";
import { ErrorLine } from "../../ui/kit";
import { BROWSER_LEFT, BROWSER_TOP } from "./layout";
import { useBrowser } from "./useBrowser";
import { BookmarksBar, TabStrip, Toolbar } from "./Chrome";
import { Sidebar } from "./Sidebar";
import { BookmarksPage, HistoryPage } from "./Pages";
import { DownloadsPage, NewTabPage, SettingsPage } from "./PagesMore";
import { getEngine, listBookmarks, type Bookmark } from "./store";
import { hostOf, type Engine } from "./url";
import "./browser.css";

export type Page = "bookmarks" | "history" | "downloads" | "settings" | null;

export default function BrowserPanel(_: { module: ModuleManifest }) {
  const [err, setErr] = useState<string | null>(null);
  const onError = useCallback((e: unknown) => setErr(String(e)), []);
  const [page, setPage] = useState<Page>(null);
  const [engine, setEngineState] = useState<Engine>("duckduckgo");
  const [marks, setMarks] = useState<Bookmark[]>([]);
  const b = useBrowser(onError, page !== null);
  const reloadMarks = useCallback(() => listBookmarks().then(setMarks).catch(onError), []);
  useEffect(() => { getEngine().then(setEngineState).catch(onError); reloadMarks(); }, []);
  const openInOpera = (url: string) => invoke<string>("open_in_opera", { url }).catch(onError);
  const show = (url: string, priv = false) => { setPage(null); b.open(url, priv); };
  const openApp = (url: string) => { // one tab per web app, like Opera's sidebar
    const t = b.s.tabs.find((x) => !x.private && x.url && hostOf(x.url) === hostOf(url));
    if (t) { setPage(null); b.activate(t.id); } else show(url);
  };
  const style = { "--b-top": `${BROWSER_TOP}px`, "--b-left": `${BROWSER_LEFT}px` } as CSSProperties;
  return (
    <div className="br-root" style={style}>
      <div className="br-band">
        <TabStrip b={b} onNew={(priv) => { setPage(null); b.open("", priv); }} />
        <Toolbar b={b} engine={engine} page={page} setPage={setPage} marks={marks} onMarks={reloadMarks} onError={onError} onOpera={openInOpera} />
        <BookmarksBar marks={marks} open={(u) => { setPage(null); b.navigate(u); }} openTab={show} />
      </div>
      <Sidebar open={openApp} onError={onError} />
      <div className="br-page">
        {err && <ErrorLine message={err} />}
        {page === "bookmarks" && <BookmarksPage marks={marks} reload={reloadMarks} open={show} opera={openInOpera} onError={onError} />}
        {page === "history" && <HistoryPage open={show} onError={onError} />}
        {page === "downloads" && <DownloadsPage list={b.downloads} onError={onError} />}
        {page === "settings" && <SettingsPage engine={engine} setEngine={setEngineState} onError={onError} />}
        {page === null && (!b.active || !b.active.url) && <NewTabPage engine={engine} marks={marks} go={(u) => (b.active ? b.navigate(u) : b.open(u))} />}
      </div>
    </div>
  );
}
