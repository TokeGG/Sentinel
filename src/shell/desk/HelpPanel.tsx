// Help panel (hub.help): every module explained, generated from manifests.
import { useState } from "react";
import { registry } from "../../core/module";
import { helpEntries, TOUR } from "./helpLogic";
import { sendCmd } from "./shellCmd";
import "./desk.css";

export function HelpPanel() {
  const [q, setQ] = useState("");
  const list = helpEntries(registry, q);
  return (
    <div className="hlp">
      <h3>Getting around</h3>
      <ul>{TOUR.map((t) => <li key={t.title}><strong>{t.title}.</strong> {t.body}</li>)}</ul>
      <p className="ui-meta">Shortcuts: Ctrl+K search, Ctrl+Shift+T reopen closed, Alt+Left/Right back/forward, Ctrl+Shift+F focus mode, F1 help.</p>
      <h3>Modules ({list.length})</h3>
      <input className="hlp-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter modules" aria-label="Filter modules" />
      {list.map((e) => (
        <div key={e.id} className="hlp-item">
          <button className="mh-btn" onClick={() => sendCmd({ type: "open", id: e.id })}>{e.name}</button>
          <div>{e.description}</div>
          {e.extras.length > 0 && <small className="ui-meta">{e.extras.join(" | ")}</small>}
        </div>
      ))}
    </div>
  );
}
