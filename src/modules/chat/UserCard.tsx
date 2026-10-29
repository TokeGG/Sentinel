// Per-user popover: local nickname, colour, ignore. Stored on this PC only.
import { useState } from "react";
import { cleanValue, isHexColor, userKey } from "./chatExtras";
import { usePrefs } from "./prefsContext";

export function UserCard({ site, user, onClose }: { site: string; user: string; onClose(): void }) {
  const p = usePrefs();
  const key = userKey(site, user);
  const cur = p.users.get(key) ?? { nick: "", color: "" };
  const [nick, setNick] = useState(cur.nick);
  const [color, setColor] = useState(cur.color || "#c28efb");
  const ignored = p.filters.ignore.has(user.toLowerCase());
  return (
    <div className="chat-usercard" role="dialog" aria-label={`User ${user}`}>
      <b>{user}</b>
      <label>Nickname <input value={nick} maxLength={40} onChange={(e) => setNick(e.target.value)} /></label>
      <label>Colour <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
      <div className="chat-row-btns">
        <button type="button" className="ui-btn primary" onClick={() => { p.setUser(key, { nick: cleanValue(nick), color: isHexColor(color) ? color : "" }); onClose(); }}>Save</button>
        <button type="button" className="ui-btn" onClick={() => { p.setUser(key, { nick: "", color: "" }); onClose(); }}>Reset</button>
        <button type="button" className="ui-btn" onClick={() => { p.setFilter("ignore", user.toLowerCase(), !ignored); onClose(); }}>{ignored ? "Unignore" : "Ignore"}</button>
        <button type="button" className="ui-link" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
