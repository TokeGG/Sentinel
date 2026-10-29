import { useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import type { SiteNote } from "./siteNotes";

/** Per-site notebook: what the bot learned about each site (fed into its prompt as data). Edit or delete freely. */
export function SitesPane({ sites, run, busy, reload }: { sites: SiteNote[]; run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const [host, setHost] = useState("");
  const [text, setText] = useState("");
  const go = async (skill: string, args: Record<string, unknown>) => { if ((await run(skill, args)) !== undefined) reload(); };
  return (
    <div className="bot-goal">
      <input className="ui-file-text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="Site, e.g. example.com" aria-label="Site" />
      <textarea className="ui-file-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the bot should know about this site" aria-label="Site note" />
      <div className="ui-actions"><button type="button" className="ui-btn" disabled={busy || !host.trim() || !text.trim()} onClick={() => void go("put_site_note", { host, text }).then(() => { setHost(""); setText(""); })}>Save</button></div>
      {sites.length === 0 ? <EmptyState title="Nothing learned about any site yet" /> : sites.map((s) => (
        <Row key={s.host} end={<span className="ui-actions">
          <button type="button" className="ui-btn" onClick={() => { setHost(s.host); setText(s.text); }}>Edit</button>
          <ConfirmButton label="Delete" disabled={busy} onConfirm={() => void go("delete_site_note", { host: s.host })} />
        </span>}>
          <strong>{s.host}</strong> <span className="ui-meta">{s.text.split("\n").length} lines</span>
        </Row>
      ))}
    </div>
  );
}
