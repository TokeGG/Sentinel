// Command palette + universal search (panel hub.palette, opened by Ctrl+K).
import { useEffect, useRef, useState } from "react";
import { searchAll, type Hit } from "../../core/search/registry";
import { errorText } from "../../ui/moduleRun";
import { closePanel } from "../panelApi";
import { PALETTE_ID } from "./ids";
import { registerBuiltins, resetContent } from "./providers";
import "./desk.css";

const KIND: Record<Hit["kind"], string> = { panel: "Panel", command: "Command", skill: "Action", setting: "Setting", content: "Found" };

export function Palette() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { registerBuiltins(); resetContent(); input.current?.focus(); }, []);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => searchAll(q, 40).then((h) => { if (live) { setHits(h); setSel(0); } }), 80);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  const close = () => closePanel(PALETTE_ID).catch(() => {});
  const run = async (h: Hit | undefined) => {
    if (!h) return;
    try {
      setMsg(`Running: ${h.title}`);
      await h.run();
      await close();
    } catch (e) { setMsg(errorText(e)); }
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") run(hits[sel]);
    else if (e.key === "Escape") close();
  };
  return (
    <div className="pal" onKeyDown={key}>
      <input ref={input} className="pal-in" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search panels, actions, settings, notes, news, deals, repos..." aria-label="Search" />
      {msg && <p className="pal-msg ui-meta">{msg}</p>}
      <ul className="pal-list" role="listbox">
        {hits.map((h, i) => (
          <li key={h.key} role="option" aria-selected={i === sel} className={i === sel ? "on" : ""}
            onMouseEnter={() => setSel(i)} onClick={() => run(h)}>
            <span className="pal-kind">{KIND[h.kind]}</span>
            <span className="pal-title">{h.title}</span>
            {h.subtitle && <small className="pal-sub">{h.subtitle}</small>}
          </li>
        ))}
        {hits.length === 0 && <li className="pal-empty ui-meta">No matches</li>}
      </ul>
    </div>
  );
}
