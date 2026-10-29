// ICS import (paste text or pick a .ics file -> preview -> confirm) and export.
import { useState } from "react";
import { parseIcs, type IcsEvent } from "./ics";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

const when = (e: IcsEvent) => (e.allDay ? e.start : e.start.replace("T", " "));

export function IcsTools({ busy, run }: { busy: boolean; run: Run }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<{ events: IcsEvent[]; skipped: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const preview = (t: string) => { setText(t); setFound(parseIcs(t)); setMsg(null); };
  return (
    <div className="cal-ics">
      <div className="ui-controls">
        <label className="ui-btn">
          Choose .ics file…
          <input type="file" accept=".ics,text/calendar" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) preview(await f.text()); }} />
        </label>
        <button type="button" className="ui-btn" disabled={busy} onClick={async () => {
          const out = (await run("export_ics")) as { ok?: boolean; count?: number } | undefined;
          if (out) setMsg(out.ok ? `Exported ${out.count} event(s).` : "Export cancelled.");
        }}>Export events (.ics)</button>
      </div>
      <textarea className="cal-paste" value={text} onChange={(e) => preview(e.target.value)} placeholder="…or paste calendar text (BEGIN:VCALENDAR …) here" aria-label="Paste ICS text" rows={3} />
      {found && (
        <div className="ui-banner" role="alertdialog" aria-label="Confirm import">
          <strong>{found.events.length} event(s) found</strong>
          {found.skipped > 0 && <span className="ui-meta"> · {found.skipped} skipped (no title or date)</span>}
          <ul className="cal-prev">
            {found.events.slice(0, 8).map((e, i) => <li key={i}>{when(e)} — {e.title}{e.rrule ? " (repeats)" : ""}</li>)}
            {found.events.length > 8 && <li className="ui-meta">…and {found.events.length - 8} more</li>}
          </ul>
          <div className="ui-controls">
            <button type="button" className="ui-btn primary" disabled={busy || !found.events.length} onClick={async () => {
              const out = (await run("import_ics", { events: found.events })) as { added: number; skipped: number } | undefined;
              if (out) { setMsg(`Imported ${out.added}; ${out.skipped} already there.`); setFound(null); setText(""); }
            }}>Import {found.events.length}</button>
            <button type="button" className="ui-btn" onClick={() => { setFound(null); setText(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <span className="ui-meta" role="status">{msg}</span>}
    </div>
  );
}
