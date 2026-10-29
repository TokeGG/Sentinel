// Reader add-ons: conversation strip, snooze menu, unsubscribe helper (confirm first).
import { useState } from "react";
import { openLink as openUrl } from "../../ui/openLink"; // in-app browser or system (links_open_in)
import { safeLink } from "../../ui/safeLink";
import { parseUnsubscribe, snoozeChoices, snoozeLabel } from "./mailExtras";
import { dateLabel, senderLabel } from "./panelLogic";
import { msgKey } from "./threads";
import type { Msg } from "./types";

export function ThreadStrip({ thread, selKey, onPick }: { thread: Msg[]; selKey: string | null; onPick: (m: Msg) => void }) {
  if (thread.length < 2) return null;
  return (
    <ol className="mail-thread" aria-label="Conversation">
      {thread.map((m) => (
        <li key={msgKey(m)}><button type="button" className={msgKey(m) === selKey ? "active" : ""} onClick={() => onPick(m)}>
          <b>{senderLabel(m)}</b> <time>{dateLabel(m.dateTs)}</time>{!m.seen && <i className="mail-dot" />}</button></li>
      ))}
    </ol>
  );
}

export function SnoozeMenu({ until, onSnooze }: { until: number | undefined; onSnooze: (until: number | null) => void }) {
  const [open, setOpen] = useState(false);
  if (until) return <span className="mail-note">Snoozed until {snoozeLabel(until)} <button type="button" className="ui-link" onClick={() => onSnooze(null)}>Unsnooze</button></span>;
  return (
    <span className="mail-snooze">
      <button type="button" className="ui-btn" onClick={() => setOpen(!open)}>Snooze…</button>
      {open && <span className="mail-menu">{snoozeChoices(new Date()).map((c) => (
        <button key={c.label} type="button" className="ui-btn" onClick={() => { setOpen(false); onSnooze(c.until); }}>{c.label}</button>
      ))}</span>}
    </span>
  );
}

export function Unsubscribe({ raw, busy, onMail }: { raw: string; busy: boolean; onMail: (to: string, subject: string, body: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const u = parseUnsubscribe(raw);
  const link = u.https ? safeLink(u.https) : null;
  if (!link && !u.mailto) return null;
  if (!confirm) return <button type="button" className="ui-btn" onClick={() => setConfirm(true)}>Unsubscribe…</button>;
  return (
    <div className="mail-confirm">
      {link ? <>Open the sender’s unsubscribe page? <small>{link}</small></> : <>Send an unsubscribe email to {u.mailto!.to}?</>}
      <button type="button" className="ui-btn" disabled={busy} onClick={() => { setConfirm(false); if (link) void openUrl(link); else onMail(u.mailto!.to, u.mailto!.subject, u.mailto!.body); }}>
        {link ? "Open page" : "Send"}</button>
      <button type="button" className="ui-btn" onClick={() => setConfirm(false)}>Cancel</button>
    </div>
  );
}
