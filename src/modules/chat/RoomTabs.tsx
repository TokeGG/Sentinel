import { connectorOf } from "./connectors";
import { showsEmbed } from "./panelLogic";
import type { Room, RoomState } from "./types";

type Props = {
  rooms: Room[];
  shown: Set<string>;
  unread: Record<string, number>;
  busy: boolean;
  states: Record<string, RoomState>;
  fallback: Set<string>;
  onSelect(id: string): void;
  onAct(skill: "move_room" | "pin_room" | "remove_room", id: string, dir?: -1 | 1): void;
};

// Tab strip: a coloured dot per site, unread count, and (on the open tab)
// move left/right, pin (keeps it in the columns layout) and close.
const DOT: Record<string, string> = { open: "#3ecf6e", connecting: "#e0b030", closed: "#e0b030", error: "#e5484d", embed: "#4a90e2" };

export function RoomTabs({ rooms, shown, unread, busy, states, fallback, onSelect, onAct }: Props) {
  return (
    <>
      {rooms.map((r) => {
        const on = shown.has(r.id);
        const st: RoomState | undefined = showsEmbed(connectorOf(r.site), fallback.has(r.id)) ? { status: "embed" } : states[r.id];
        return (
          <span key={r.id} className={`chat-tab${on ? " on" : ""}`}>
            <button type="button" className="chat-tab-main" onClick={() => onSelect(r.id)} title={`${connectorOf(r.site).label}: ${r.target}`}>
              <i className="chat-dot" style={{ background: connectorOf(r.site).color }} />
              {r.label}
              {st && <i className="chat-state" style={{ background: DOT[st.status] }} title={`${st.status}${st.detail ? `: ${st.detail}` : ""}`} />}
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
