// Reader mode + shared News view prefs. The article is fetched only on the Reader button, sanitized
// (allow-list, no scripts, no remote images) and shown in a sandbox="" iframe.
import { createContext, useContext, useState } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import { spoilerHit } from "../../core/spoiler";
import { SpoilerGate } from "../../ui/wordList";
import { readerDoc } from "./newsPrefsLogic";

export interface NewsViewPrefs { headlineOnly: boolean; fontPx: number; widthCh: number; spoilers: string[] }
export const NewsViewCtx = createContext<NewsViewPrefs>({ headlineOnly: false, fontPx: 15, widthCh: 70, spoilers: [] });
export const useNewsView = () => useContext(NewsViewCtx);

export function NewsSpoiler({ title, children }: { title: unknown; children: React.ReactNode }) {
  return <SpoilerGate hit={spoilerHit(String(title ?? ""), useNewsView().spoilers)}>{children}</SpoilerGate>;
}

export function Reader({ link, title }: { link: string | null; title: string }) {
  const v = useNewsView();
  const [doc, setDoc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!link) return null;
  const load = async () => {
    setErr(null);
    try {
      const res = await fetch(link);
      if (!res.ok) throw new Error(`the site answered ${res.status}`);
      setDoc(readerDoc(await res.text(), title, v.fontPx, v.widthCh));
    } catch (e) { setErr(`Reader failed: ${String((e as Error)?.message ?? e)}`); }
  };
  return (
    <>
      <button type="button" className="ui-btn ui-sm" onClick={() => (doc ? setDoc(null) : void load())}>{doc ? "Close reader" : "Reader"}</button>
      {err && <span className="ui-meta">{err}</span>}
      {doc && <iframe className="nw-reader" title={`Reader: ${title}`} sandbox="" srcDoc={doc} />}
    </>
  );
}
