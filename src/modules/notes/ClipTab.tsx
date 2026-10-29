// URL clipper: fetch a page, readability-lite to text, preview, then save as a note.
import { fetch } from "@tauri-apps/plugin-http";
import { useState } from "react";
import { ErrorLine } from "../../ui/kit";
import { clipNote, extractReadable, isHttpUrl } from "./clipper";
import { createNote } from "./store";

export function ClipTab({ onSaved }: { onSaved(id: number): void }) {
  const [url, setUrl] = useState("");
  const [page, setPage] = useState<{ title: string; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  const fetchPage = () => go(async () => {
    if (!isHttpUrl(url)) throw new Error("Enter an http(s) URL");
    const res = await fetch(url.trim(), { headers: { Accept: "text/html" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setPage(extractReadable((await res.text()).slice(0, 3_000_000), url.trim()));
  });
  return (
    <div className="nt-clip">
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); void fetchPage(); }}>
        <input placeholder="https://… page to clip" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="submit" className="ui-btn primary" disabled={busy}>{busy ? "Fetching…" : "Fetch"}</button>
      </form>
      {err && <ErrorLine message={err} onDismiss={() => setErr(null)} />}
      {page && (
        <div className="nt-clipview">
          <h4>{page.title}</h4>
          <pre className="nt-pre">{page.text.slice(0, 3000)}{page.text.length > 3000 ? "\n…" : ""}</pre>
          <button type="button" className="ui-btn primary" disabled={busy}
            onClick={() => void go(async () => { onSaved(await createNote(clipNote(url.trim(), page.title, page.text), "Clips", "clip")); setPage(null); setUrl(""); })}>Save as note</button>
          <button type="button" className="ui-btn" onClick={() => setPage(null)}>Discard</button>
        </div>
      )}
    </div>
  );
}
