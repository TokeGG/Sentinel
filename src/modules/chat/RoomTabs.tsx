import { connectorOf } from "./connectors";
import type { Room } from "./types";

type Props = {
  rooms: Room[];
  shown: Set<string>;
  unread: Record<string, number>;
  busy: boolean;
  onSelect(id: string): void;
  onAct(skill: "move_room" | "pin_room" | "remove_room", id: string, dir?: -1 | 1): void;
};

// Tab strip: a coloured dot per site, unread count, and (on the open tab)
// move left/right, pin (keeps it in the columns layout) and close.
export function RoomTabs({ rooms, shown, unread, busy, onSelect, onAct }: Props) {
  return (
    <>
      {rooms.map((r) => {
        const on = shown.has(r.id);
        return (
          <span key={r.id} className={`chat-tab${on ? " on" : ""}`}>
            <button type="button" className="chat-tab-main" onClick={() => onSelect(r.id)} title={`${connectorOf(r.site).label}: ${r.target}`}>
              <i className="chat-dot" style={{ background: connectorOf(r.site).color }} />
              {r.label}
              {r.pinned && " 📌"}
              {!on && unread[r.id] ? <em className="chat-unread">{unread[r.id] > 99 ? "99+" : unread[r.id]}</em> : null}
            </button>
            {on && (
              <>
                <button type="button" className="chat-x" disabled={busy} title="Move left" onClick={() => onAct("move_room", r.id, -1)}>◀</button>
                <button type="button" className="chat-x" disabled={busy} title="Move right" onClick={() => onAct("move_room", r.id, 1)}>▶</button>
                <button type="button" className="chat-x" disabled={busy} title="Pin: columns layout shows pinned rooms" onClick={() => onAct("pin_room", r.id)}>{r.pinned ? "Unpin" : "Pin"}</button>
                <button type="button" className="chat-x" disabled={busy} title="Close room" onClick={() => onAct("remove_room", r.id)}>✕</button>
              </>
            )}
          </span>
        );
      })}
    </>
  );
}
