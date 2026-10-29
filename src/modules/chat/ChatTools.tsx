// Filters (ignore list, hidden words, highlight keywords) and the local log search
// (mention log = mentions + highlight hits, kept even when full logs are off).
import { useEffect, useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { cleanValue } from "./chatExtras";
import { clearLogs, searchLogs, type LogRow } from "./extrasStore";
import { clock } from "./panelLogic";
import { usePrefs } from "./prefsContext";

const KINDS = [{ k: "ignore", label: "Ignored users" }, { k: "word", label: "Hidden words" }, { k: "highlight", label: "Highlight keywords" }];

export function FiltersTool() {
  const p = usePrefs();
  const [kind, setKind] = useState("highlight");
  const [v, setV] = useState("");
  return (
    <div className="chat-tool">
      {KINDS.map(({ k, label }) => (
        <div key={k}><b>{label}</b> {p.filterRows.filter((r) => r.kind === k).map((r) => (
          <button key={r.value} type="button" className="kit-chip" title="Remove" onClick={() => p.setFilter(k, r.value, false)}>{r.value} ×</button>
        ))}</div>
      ))}
      <form className="chat-row-btns" onSubmit={(e) => { e.preventDefault(); const x = cleanValue(v).toLowerCase(); if (x) { p.setFilter(kind, x, true); setV(""); } }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
        <input value={v} placeholder="user or word" onChange={(e) => setV(e.target.value)} />
        <button type="submit" className="ui-btn">Add</button>
      </form>
    </div>
  );
}

export function LogsTool() {
  const p = usePrefs();
  const [q, setQ] = useState("");
  const [mentions, setMentions] = useState(!p.logs);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [v, setV] = useState(0);
  useEffect(() => { let live = true; const t = setTimeout(() => void searchLogs(q, mentions).then((r) => live && setRows(r)).catch(() => {}), 250); return () => { live = false; clearTimeout(t); }; }, [q, mentions, v]);
  return (
    <div className="chat-tool">
      <p className="chat-help">{p.logs ? `Searchable logs are on (newest ${p.logCap} kept).` : "Full logs are off (turn on in Customize). Mentions and highlight hits are kept in the mention log (newest 500)."}</p>
      <div className="chat-row-btns">
        <input type="search" placeholder="Search logs" value={q} onChange={(e) => setQ(e.target.value)} />
        <label><input type="checkbox" checked={mentions} onChange={(e) => setMentions(e.target.checked)} /> Mentions only</label>
        <ConfirmButton label="Clear logs" onConfirm={() => void clearLogs().then(() => setV((n) => n + 1))} />
      </div>
      <div className="chat-logrows">{rows.map((r) => (
        <div key={r.id} className={`chat-row${r.mention ? " chat-mention" : ""}`}><time>{new Date(r.ts).toLocaleDateString()} {clock(r.ts)}</time> <i>{r.room}</i> <b>{r.user}</b>: {r.text}</div>
      ))}{!rows.length && <p className="chat-help">Nothing logged{q ? " matches" : " yet"}.</p>}</div>
    </div>
  );
}
