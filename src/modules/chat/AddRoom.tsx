import { useState } from "react";
import { connectors, connectorOf } from "./connectors";
import { detectRoom } from "./connectors/rooms";

// "+" popover: pick a site (or auto-detect from a pasted URL) and add the room.
export function AddRoom({ busy, onAdd }: { busy: boolean; onAdd(input: string, site: string): Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState("auto");
  const [input, setInput] = useState("");
  const ref = input.trim() ? detectRoom(input, site) : null;
  if (!open) return <button type="button" className="ui-btn chat-plus" title="Add room" onClick={() => setOpen(true)}>+</button>;
  return (
    <form
      className="chat-add"
      onSubmit={async (e) => {
        e.preventDefault();
        if (ref && (await onAdd(input, site)) !== undefined) {
          setInput("");
          setOpen(false);
        }
      }}
    >
      <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site">
        <option value="auto">Auto-detect (paste a URL)</option>
        {connectors.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder={site === "auto" ? "paste a chat URL, e.g. twitch.tv/name" : connectorOf(site).placeholder} />
      <button type="submit" className="ui-btn primary" disabled={busy || !ref}>Add</button>
      <button type="button" className="ui-btn" onClick={() => setOpen(false)}>Cancel</button>
      {input.trim() && <span className="chat-hint">{ref ? `→ ${connectorOf(ref.site).label}: ${ref.label}` : "not recognised"}</span>}
    </form>
  );
}
