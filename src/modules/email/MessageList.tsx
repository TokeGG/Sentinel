import { dateLabel, previewLine, senderLabel, subjectLabel } from "./panelLogic";
import type { Msg } from "./types";

export function MessageList({ msgs, uid, query, onQuery, onPick, onStar, onMore, busy }: {
  msgs: Msg[]; uid: number | null; query: string; onQuery: (q: string) => void;
  onPick: (m: Msg) => void; onStar: (m: Msg) => void; onMore: () => void; busy: boolean;
}) {
  return (
    <div className="mail-list">
      <input type="search" placeholder="Search cached mail (sender, subject, preview)" value={query} onChange={(e) => onQuery(e.target.value)} />
      {!msgs.length && <div className="mail-empty">{query ? "No matches in cached mail." : "No messages cached. Press Refresh."}</div>}
      <ul>
        {msgs.map((m) => (
          <li key={m.uid} className={`${m.uid === uid ? "active" : ""} ${m.seen ? "" : "unread"}`}>
            <button type="button" className="mail-star" title={m.starred ? "Unstar" : "Star"} onClick={() => onStar(m)}>{m.starred ? "★" : "☆"}</button>
            <button type="button" className="mail-item" onClick={() => onPick(m)}>
              <span className="mail-top"><i className="mail-dot" aria-label={m.seen ? "read" : "unread"} /><b>{senderLabel(m)}</b><time>{dateLabel(m.dateTs)}</time></span>
              <span className="mail-subj">{m.hasAttach ? "📎 " : ""}{subjectLabel(m.subject)}</span>
              <span className="mail-prev">{previewLine(m.preview)}</span>
            </button>
          </li>
        ))}
      </ul>
      {msgs.length > 0 && !query && <button type="button" className="ui-btn" disabled={busy} onClick={onMore}>Load older</button>}
    </div>
  );
}
