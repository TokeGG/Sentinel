// Home rows: Continue watching (saved progress) and the Watch-later tray.
import { useState } from "react";
import type { Card, CardActions } from "./Cards";
import { progressPct, type Progress } from "./extras";
import { thumbUrl } from "./panelLogic";

export function ContinueRow({ items, act, named, onDrop }: { items: Progress[]; act: CardActions; named: (id: string | null) => string; onDrop: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <><h3 className="yt-h">Continue watching</h3>
      <div className="yt-row">{items.map((p) => (
        <div key={p.videoId} className="yt-mini-card">
          <button type="button" title={p.title} onClick={() => act.play({ videoId: p.videoId, channelId: p.channelId, channel: named(p.channelId), title: p.title, meta: "" })}>
            <img className="yt-thumb" src={thumbUrl(p.videoId)} alt="" loading="lazy" />
            <span className="yt-progress"><i style={{ width: `${progressPct(p)}%` }} /></span>
            <span className="yt-ctitle">{p.title}</span>
          </button>
          <button type="button" className="ui-link" onClick={() => onDrop(p.videoId)}>Remove</button>
        </div>
      ))}</div></>
  );
}

export function LaterTray({ cards, act }: { cards: Card[]; act: CardActions }) {
  const [open, setOpen] = useState(false);
  if (!cards.length) return null;
  return (
    <div className={`yt-tray${open ? " open" : ""}`}>
      <button type="button" className="ui-btn ui-sm" aria-expanded={open} onClick={() => setOpen(!open)}>⏲ Watch later ({cards.length}) {open ? "▾" : "▴"}</button>
      {open && <div className="yt-row">{cards.slice(0, 20).map((c) => (
        <button key={c.videoId} type="button" className="yt-mini-card" title={c.title} onClick={() => act.play(c)}>
          <img className="yt-thumb" src={thumbUrl(c.videoId)} alt="" loading="lazy" /><span className="yt-ctitle">{c.title}</span>
        </button>
      ))}</div>}
    </div>
  );
}
