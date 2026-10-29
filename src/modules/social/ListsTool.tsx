// Manage follow lists (groups of accounts used as feed filters) and mutes.
import { useState } from "react";
import type { FeedFilters } from "./useFeedFilters";

const PLATFORMS = ["bluesky", "mastodon", "reddit"];

export function ListsTool({ f }: { f: FeedFilters }) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("bluesky");
  const [handle, setHandle] = useState("");
  const [mute, setMuteText] = useState("");
  const [kind, setKind] = useState<"word" | "account">("word");
  return (
    <div className="soc-tool">
      <b>Lists</b>
      {f.lists.map((l) => <button key={`${l.name}|${l.platform}|${l.handle}`} type="button" className="kit-chip" title="Remove from list" onClick={() => f.member(l.name, l.platform, l.handle, false)}>{l.name}: {l.platform}/{l.handle} ×</button>)}
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); if (name.trim() && handle.trim()) { f.member(name.trim().slice(0, 40), platform, handle, true); setHandle(""); } }}>
        <input placeholder="List name" value={name} onChange={(e) => setName(e.target.value)} list="soc-list-names" />
        <datalist id="soc-list-names">{f.listNames.map((n) => <option key={n} value={n} />)}</datalist>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
        <input placeholder="handle (as shown on posts)" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <button type="submit" className="ui-btn">Add to list</button>
      </form>
      <b>Muted</b>
      {f.muteRows.map((m) => <button key={`${m.kind}|${m.value}`} type="button" className="kit-chip" title="Unmute" onClick={() => f.mute(m.kind as "word" | "account", m.value, false)}>{m.kind === "word" ? "“" + m.value + "”" : m.value} ×</button>)}
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); if (mute.trim()) { f.mute(kind, mute.slice(0, 80), true); setMuteText(""); } }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as "word" | "account")}><option value="word">Word</option><option value="account">Account</option></select>
        <input placeholder={kind === "word" ? "word or phrase" : "handle or platform:handle"} value={mute} onChange={(e) => setMuteText(e.target.value)} />
        <button type="submit" className="ui-btn">Mute</button>
      </form>
    </div>
  );
}
