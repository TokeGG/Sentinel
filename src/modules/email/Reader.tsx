// Reading pane. HTML is sanitized (sanitize.ts) and shown in a sandbox="" iframe (no scripts,
// forms, popups, same-origin); remote images stay blocked until "Load images" is pressed.
import { useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { safeLink } from "../../ui/safeLink";
import { formatList } from "./addresses";
import { buildSrcdoc, sanitizeHtml } from "./sanitize";
import { fullDate, sizeLabel, subjectLabel, urlsIn } from "./panelLogic";
import type { Mode } from "./composeLogic";
import type { Body, Msg } from "./types";

export function Reader({ msg, body, busy, inTrash, onCompose, onFlag, onDelete }: {
  msg: Msg | null; body: Body | null; busy: boolean; inTrash: boolean;
  onCompose: (m: Mode) => void; onFlag: (f: "seen" | "flagged", on: boolean) => void; onDelete: () => void;
}) {
  const [images, setImages] = useState<string | null>(null); // "acct/folder/uid" the user allowed images for
  const [confirm, setConfirm] = useState(false);
  const key = msg ? `${msg.accountId}/${msg.folder}/${msg.uid}` : "";
  const load = images === key;
  const clean = useMemo(() => (body?.html ? sanitizeHtml(body.html, { loadImages: load }) : null), [body, load]);
  if (!msg) return <div className="mail-reader mail-empty">Select a message.</div>;
  const links = clean ? clean.links : urlsIn(body?.text ?? "");
  return (
    <div className="mail-reader">
      <div className="mail-actions">
        <button type="button" className="ui-btn" onClick={() => onCompose("reply")}>Reply</button>
        <button type="button" className="ui-btn" onClick={() => onCompose("replyAll")}>Reply all</button>
        <button type="button" className="ui-btn" onClick={() => onCompose("forward")}>Forward</button>
        <button type="button" className="ui-btn" disabled={busy} onClick={() => onFlag("flagged", !msg.starred)}>{msg.starred ? "Unstar" : "Star"}</button>
        <button type="button" className="ui-btn" disabled={busy} onClick={() => onFlag("seen", !msg.seen)}>Mark {msg.seen ? "unread" : "read"}</button>
        {!confirm && <button type="button" className="ui-btn" onClick={() => setConfirm(true)}>{inTrash ? "Delete…" : "Trash…"}</button>}
      </div>
      {confirm && (
        <div className="mail-confirm">
          {inTrash ? "Permanently delete" : "Move to Trash"}: “{subjectLabel(msg.subject)}” from {msg.fromAddr}?{inTrash && " This cannot be undone."}
          <button type="button" className="ui-btn" disabled={busy} onClick={() => { setConfirm(false); onDelete(); }}>{inTrash ? "Delete forever" : "Move to Trash"}</button>
          <button type="button" className="ui-btn" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
      <h3>{subjectLabel(msg.subject)}</h3>
      <dl className="mail-hdr">
        <dt>From</dt><dd>{body?.from.length ? formatList(body.from) : msg.fromAddr}</dd>
        <dt>To</dt><dd>{body ? formatList(body.to) : msg.to}</dd>
        {!!body?.cc.length && <><dt>Cc</dt><dd>{formatList(body.cc)}</dd></>}
        <dt>Date</dt><dd>{fullDate(msg.dateTs)}</dd>
      </dl>
      {!body && <div className="mail-empty">Loading…</div>}
      {clean && clean.blockedImages > 0 && !load && (
        <div className="mail-confirm">{clean.blockedImages} remote image(s) blocked (they can reveal when you read this mail).
          <button type="button" className="ui-btn" onClick={() => setImages(key)}>Load images</button></div>
      )}
      {clean ? <iframe className="mail-frame" title="Message body" sandbox="" srcDoc={buildSrcdoc(clean.html, load)} />
        : body && <pre className="mail-text">{body.text || "(empty message)"}</pre>}
      {links.length > 0 && (
        <details className="mail-links"><summary>Links in this message ({links.length})</summary>
          {links.map((l) => <div key={l.url}><button type="button" className="ui-link" title={l.url} onClick={() => { const u = safeLink(l.url); if (u) void openUrl(u); }}>{l.text || l.url}</button> <small>{l.url}</small></div>)}
        </details>
      )}
      {!!body?.attachments.length && (
        <ul className="mail-att">{body.attachments.map((a, i) => <li key={i}>📎 {a.name} <small>{a.mime} · {sizeLabel(a.size)}</small></li>)}</ul>
      )}
    </div>
  );
}
