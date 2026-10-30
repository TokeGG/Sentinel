// Downloads list, browser settings (search engine, where app links open, sidebar apps), new-tab page.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { useLimit } from "../../ui/useOption";
import { browserOptions } from "./layout";
import type { Download } from "./useBrowser";
import { APPS_CHANGED } from "./Sidebar";
import { addApp, getLinksOpenIn, listApps, removeApp, setEngine, setLinksOpenIn, type Bookmark, type WebApp } from "./store";
import { ENGINES, hostOf, isEngine, normalizeInput, type Engine } from "./url";

const reveal = (path: string | null) => invoke("browser_open_downloads", { path });

export function DownloadsPage({ list, onError }: { list: Download[]; onError(e: unknown): void }) {
  return (
    <div className="br-sheet">
      <div className="br-sheet-head"><h3>Downloads</h3>
        <button className="ui-btn" onClick={() => reveal(null).catch(onError)}>Open Downloads folder</button></div>
      {!list.length && <p className="ui-meta">Files you download in this session are listed here (saved to your Downloads folder).</p>}
      {list.map((d, i) => (
        <div key={i} className="br-row">
          <span className={d.ok ? "" : "ui-meta"}>{d.path?.split(/[\\/]/).pop() ?? hostOf(d.url)}{d.ok ? "" : " (failed)"}</span>
          {d.ok && d.path && <button className="ui-btn" onClick={() => reveal(d.path).catch(onError)}>Show in folder</button>}
        </div>
      ))}
    </div>
  );
}

export function SettingsPage({ engine, setEngine: setLocal, onError }: { engine: Engine; setEngine(e: Engine): void; onError(e: unknown): void }) {
  const [where, setWhere] = useState<"app" | "system">("app");
  const [apps, setApps] = useState<WebApp[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const loadApps = () => listApps().then((a) => { setApps(a); window.dispatchEvent(new Event(APPS_CHANGED)); }).catch(onError);
  useEffect(() => { getLinksOpenIn().then(setWhere).catch(onError); loadApps(); }, []);
  return (
    <div className="br-sheet">
      <h3>Browser settings</h3>
      <label className="br-row">Search engine
        <select value={engine} onChange={(e) => { const v = e.target.value; if (isEngine(v)) { setLocal(v); setEngine(v).catch(onError); } }}>
          {Object.entries(ENGINES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
        </select></label>
      <label className="br-row">Links from other panels open in
        <select value={where} onChange={(e) => { const v = e.target.value === "system" ? "system" : "app"; setWhere(v); setLinksOpenIn(v).catch(onError); }}>
          <option value="app">this browser</option><option value="system">the system browser</option>
        </select></label>
      <h4>Sidebar web apps</h4>
      {apps.map((a) => (
        <div key={a.id} className="br-row"><span>{a.name}</span><span className="ui-meta">{hostOf(a.url)}</span>
          <ConfirmButton label="Remove" onConfirm={() => removeApp(a.id).then(loadApps, onError)} /></div>
      ))}
      <form className="br-row" onSubmit={(e) => { e.preventDefault(); addApp(name, normalizeInput(url)).then(() => { setName(""); setUrl(""); loadApps(); }, onError); }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="App name" />
        <input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} aria-label="App address" />
        <button className="ui-btn" disabled={!url.trim()}>Add</button>
      </form>
      <p className="ui-meta">Sign-ins are kept in the browser's own profile. Private tabs keep nothing.</p>
    </div>
  );
}

export function NewTabPage({ engine, marks, go }: { engine: Engine; marks: Bookmark[]; go(url: string): void }) {
  const dial = useLimit(browserOptions, "speedDial");
  const [q, setQ] = useState("");
  return (
    <div className="br-newtab">
      <form onSubmit={(e) => { e.preventDefault(); const u = normalizeInput(q, engine); if (u) go(u); }}>
        <input autoFocus className="br-addr" placeholder={`Search with ${ENGINES[engine].name} or enter address`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </form>
      <div className="br-dial">
        {marks.slice(0, dial).map((m) => <button key={m.id} title={m.url} onClick={() => go(m.url)}><b>{(m.title || hostOf(m.url)).slice(0, 1)}</b>{m.title || hostOf(m.url)}</button>)}
      </div>
    </div>
  );
}
