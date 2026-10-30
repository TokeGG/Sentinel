// Manage Social site tabs: add (preset or any https URL), rename, reorder (drag or
// Alt+Arrow / buttons), delete (two-step confirm). Feed stays first and is not listed.
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { ErrorLine } from "../../ui/kit";
import { SITE_PRESETS, parseSiteUrl, type EmbedSite, type TabAction } from "./embedSites";

export function TabsEditor({ sites, dispatch, error }: { sites: EmbedSite[]; dispatch: (a: TabAction) => void; error: string | null }) {
  const [preset, setPreset] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const pick = (k: string) => {
    setPreset(k);
    const p = SITE_PRESETS.find((x) => x.key === k);
    if (p) { setName(p.label); setUrl(p.url); }
  };
  const valid = !!name.trim() && !!parseSiteUrl(url);
  const add = () => {
    if (!valid) return;
    dispatch({ type: "add", name, url, preset: preset || undefined });
    setPreset(""); setName(""); setUrl("");
  };
  const move = (id: string, to: number) => dispatch({ type: "move", id, to });
  return (
    <div className="soc-tabedit">
      {error && <ErrorLine message={error} />}
      <ol className="soc-tablist" aria-label="Site tabs (Alt+Arrow to reorder)">
        {sites.map((s, i) => (
          <li key={s.id} draggable className={drag === s.id ? "soc-dragging" : ""}
            onDragStart={() => setDrag(s.id)} onDragEnd={() => setDrag(null)}
            onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) move(drag, i); setDrag(null); }}
            onKeyDown={(e) => {
              if (!e.altKey) return;
              if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(s.id, i - 1); }
              if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(s.id, i + 1); }
            }}>
            <span className="soc-grab" aria-hidden>⋮⋮</span>
            <input className="ui-file-text" aria-label={`Name of ${s.label}`} defaultValue={s.label} key={s.label}
              onBlur={(e) => dispatch({ type: "rename", id: s.id, label: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            <span className="soc-host">{new URL(s.url).hostname}</span>
            <button type="button" className="ui-btn" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => move(s.id, i - 1)}>↑</button>
            <button type="button" className="ui-btn" aria-label={`Move ${s.label} down`} disabled={i === sites.length - 1} onClick={() => move(s.id, i + 1)}>↓</button>
            <ConfirmButton label="Delete" title={`Remove the ${s.label} tab (its login profile stays on disk)`} onConfirm={() => dispatch({ type: "remove", id: s.id })} />
          </li>
        ))}
      </ol>
      <div className="soc-tabadd">
        <select className="ui-file-text" aria-label="Preset site" value={preset} onChange={(e) => pick(e.target.value)}>
          <option value="">Custom site…</option>
          {SITE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <input className="ui-file-text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="ui-file-text" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button type="button" className="ui-btn" disabled={!valid} onClick={add}>Add tab</button>
      </div>
    </div>
  );
}
