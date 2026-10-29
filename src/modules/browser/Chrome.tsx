// Browser band: tab strip, toolbar (nav, address/search, bookmark star, pages), bookmarks bar.
import { useEffect, useState } from "react";
import type { useBrowser } from "./useBrowser";
import type { Page } from "./Panel";
import { addBookmark, removeBookmark, type Bookmark } from "./store";
import { hostOf, normalizeInput, type Engine } from "./url";

type B = ReturnType<typeof useBrowser>;

export function TabStrip({ b, onNew }: { b: B; onNew(priv: boolean): void }) {
  return (
    <div className="br-tabs" role="tablist">
      {b.s.tabs.map((t) => (
        <div key={t.id} role="tab" aria-selected={t.id === b.s.active} className={`br-tab${t.id === b.s.active ? " on" : ""}${t.private ? " priv" : ""}`}
          title={t.url} onClick={() => b.activate(t.id)} onAuxClick={(e) => e.button === 1 && b.close(t.id)}>
          {t.private && <span className="br-priv">◐</span>}
          <span className="br-tab-title">{t.loading ? "Loading..." : t.title || hostOf(t.url) || "New tab"}</span>
          <button aria-label="Close tab" onClick={(e) => { e.stopPropagation(); b.close(t.id); }}>×</button>
        </div>
      ))}
      <button className="br-new" title="New tab" onClick={() => onNew(false)}>+</button>
      <button className="br-new" title="New private tab (no history, no saved sign-ins)" onClick={() => onNew(true)}>◐</button>
    </div>
  );
}

export function Toolbar({ b, engine, page, setPage, marks, onMarks, onError, onOpera }: {
  b: B; engine: Engine; page: Page; setPage(p: Page): void; marks: Bookmark[]; onMarks(): void; onError(e: unknown): void; onOpera(url: string): void;
}) {
  const url = b.active?.url ?? "";
  const [text, setText] = useState(url);
  useEffect(() => setText(url), [url, b.active?.id]);
  const mark = marks.find((m) => m.url === url);
  const star = () => (mark ? removeBookmark(mark.id) : addBookmark(url, b.active?.title || hostOf(url))).then(onMarks, onError);
  const tog = (p: Page) => setPage(page === p ? null : p);
  return (
    <form className="br-bar" onSubmit={(e) => { e.preventDefault(); const u = normalizeInput(text, engine); if (u) { setPage(null); b.navigate(u); } }}>
      <button type="button" title="Back" onClick={b.back} disabled={!url}>←</button>
      <button type="button" title="Forward" onClick={b.forward} disabled={!url}>→</button>
      <button type="button" title="Reload" onClick={b.reload} disabled={!url}>⟳</button>
      <input className="br-addr" value={text} onChange={(e) => setText(e.target.value)} onFocus={(e) => e.target.select()}
        placeholder="Search or enter address" aria-label="Address" spellCheck={false} />
      <button type="button" title={mark ? "Remove bookmark" : "Bookmark this page"} disabled={!url} onClick={star}>{mark ? "★" : "☆"}</button>
      <button type="button" title="Open in Opera (or the system browser)" disabled={!url} onClick={() => onOpera(url)}>↗</button>
      <button type="button" className={page === "bookmarks" ? "on" : ""} title="Bookmarks" onClick={() => tog("bookmarks")}>☰</button>
      <button type="button" className={page === "history" ? "on" : ""} title="History" onClick={() => tog("history")}>🕘</button>
      <button type="button" className={page === "downloads" ? "on" : ""} title="Downloads" onClick={() => tog("downloads")}>⭳</button>
      <button type="button" className={page === "settings" ? "on" : ""} title="Browser settings" onClick={() => tog("settings")}>⚙</button>
    </form>
  );
}

export function BookmarksBar({ marks, open, openTab }: { marks: Bookmark[]; open(u: string): void; openTab(u: string): void }) {
  const bar = marks.filter((m) => m.bar);
  return (
    <div className="br-marks">
      {bar.length === 0 && <span className="ui-meta">Bookmarks you star appear here.</span>}
      {bar.slice(0, 40).map((m) => (
        <button key={m.id} title={m.url} onClick={() => open(m.url)} onAuxClick={(e) => e.button === 1 && openTab(m.url)}>{m.title || hostOf(m.url)}</button>
      ))}
    </div>
  );
}
