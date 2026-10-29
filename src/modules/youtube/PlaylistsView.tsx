// Playlists the user creates locally (no Google account).
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { EmptyState } from "../../ui/kit";
import { CardGrid, type Card, type CardActions } from "./Cards";
import { cleanName } from "./extras";
import type { YtX } from "./useYtExtras";

export function PlaylistsView({ x, queue, act, named }: { x: YtX; queue: Set<string>; act: CardActions; named: (id: string | null) => string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [name, setName] = useState("");
  const pl = x.playlists.find((p) => p.id === open);
  const cards: Card[] = (pl?.items ?? []).map((i) => ({ ...i, channel: named(i.channelId), meta: "" }));
  return (
    <div className="yt-playlists">
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); const n = cleanName(name); if (n) { x.createPlaylist(n); setName(""); } }}>
        <input placeholder="New playlist name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="ui-btn">Create</button>
      </form>
      <div className="yt-chips">
        {x.playlists.map((p) => <button key={p.id} type="button" className={`kit-chip${p.id === open ? " on" : ""}`} onClick={() => setOpen(p.id)}>{p.name} ({p.items.length})</button>)}
      </div>
      {!x.playlists.length && <EmptyState title="No playlists" hint="Create one, then use “+ Playlist” under any video you watch." />}
      {pl && (<>
        <div className="ui-controls"><h3 className="yt-h">{pl.name}</h3>
          {pl.items[0] && <button type="button" className="ui-btn primary" onClick={() => act.play(cards[0])}>Play all</button>}
          <ConfirmButton label="Delete playlist" onConfirm={() => { x.deletePlaylist(pl.id); setOpen(null); }} /></div>
        <CardGrid cards={cards} queue={queue} act={{ ...act, notInterested: (c) => x.removeFromPlaylist(pl.id, c.videoId) }} />
        <p className="ui-meta">“Not interested” in this list removes the video from the playlist only.</p>
      </>)}
    </div>
  );
}
