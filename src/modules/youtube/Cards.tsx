import { useOption } from "../../ui/useOption";
import { isShort } from "./ytPrefs";
import { useState } from "react";
import { thumbUrl } from "./panelLogic";
import { avatar, fmtDuration } from "./viewLogic";

export interface Card {
  videoId: string;
  channelId: string | null;
  channel: string;
  title: string;
  meta: string; // "3d" etc.
  dim?: boolean;
  duration?: number | null; // seconds, only when known (feeds carry none)
}
export interface CardActions {
  play(c: Card): void;
  later(c: Card, on: boolean): void;
  notInterested(c: Card): void;
  hideChannel(c: Card): void;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const a = avatar(name);
  return (
    <span className="yt-avatar" style={{ width: size, height: size, background: `hsl(${a.hue} 55% 38%)` }} aria-hidden="true">
      {a.initial}
    </span>
  );
}

export const byLine = (c: Card) => [c.channel, c.meta].filter(Boolean).join(" · ");

export function VideoCard({ c, queued, act }: { c: Card; queued: boolean; act: CardActions }) {
  const [menu, setMenu] = useState(false);
  const dur = fmtDuration(c.duration);
  return (
    <article className={`yt-card${c.dim ? " yt-dim" : ""}`}>
      <div className="yt-thumbwrap">
        <button type="button" className="yt-thumbbtn" title={c.title} aria-label={`Play ${c.title}`} onClick={() => act.play(c)}>
          <img className="yt-thumb" src={thumbUrl(c.videoId)} alt="" loading="lazy" />
          {dur && <span className="yt-dur">{dur}</span>}
        </button>
        <button type="button" className={`yt-later${queued ? " on" : ""}`} title={queued ? "Remove from Watch later" : "Watch later"} aria-pressed={queued} onClick={() => act.later(c, !queued)}>
          {queued ? "✓" : "⏲"}
        </button>
      </div>
      <div className="yt-info">
        <Avatar name={c.channel || "?"} />
        <button type="button" className="yt-meta" onClick={() => act.play(c)}>
          <span className="yt-ctitle">{c.title}</span>
          <span className="ui-meta yt-by">{byLine(c)}</span>
        </button>
        <div className="yt-menuwrap">
          <button type="button" className="yt-dots" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>⋮</button>
          {menu && (
            <div className="yt-menu" role="menu" onMouseLeave={() => setMenu(false)}>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); act.notInterested(c); }}>Not interested</button>
              {c.channelId && <button type="button" role="menuitem" onClick={() => { setMenu(false); act.hideChannel(c); }}>Don't recommend this channel</button>}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function CardGrid({ cards, queue, act }: { cards: Card[]; queue: Set<string>; act: CardActions }) {
  const hideShorts = useOption("hideShorts", false);
  return (
    <div className="yt-grid">
      {(hideShorts ? cards.filter((c) => !isShort(c.title)) : cards).map((c) => <VideoCard key={c.videoId} c={c} queued={queue.has(c.videoId)} act={act} />)}
    </div>
  );
}
