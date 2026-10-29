import { openUrl } from "@tauri-apps/plugin-opener";
import { safeLink } from "../../ui/safeLink";
import { Avatar, byLine, type Card, type CardActions } from "./Cards";
import { Player } from "./Player";
import { thumbUrl, watchUrl } from "./panelLogic";

interface Props {
  playing: Card;
  next: Card[];
  queue: Set<string>;
  rating: "like" | "dislike" | null;
  busy: boolean;
  act: CardActions;
  onRate(r: "like" | "dislike"): void;
  onChat(): void;
  onClose(): void;
}

// Big player on the left, "Up next" on the right (stacks under it when narrow).
export function WatchView({ playing, next, queue, rating, busy, act, onRate, onChat, onClose }: Props) {
  const link = safeLink(watchUrl(playing.videoId));
  const queued = queue.has(playing.videoId);
  return (
    <div className="yt-watch">
      <div className="yt-watch-main">
        <Player videoId={playing.videoId} title={playing.title} />
        <h3 className="yt-watch-title">{playing.title}</h3>
        <div className="yt-watch-row">
          <Avatar name={playing.channel || "?"} />
          <span className="yt-meta"><span className="yt-ctitle">{playing.channel || "Unknown channel"}</span><span className="ui-meta">{playing.meta}</span></span>
          <div className="yt-actions">
            <button type="button" className={`ui-btn${rating === "like" ? " primary" : ""}`} disabled={busy} aria-pressed={rating === "like"} title="Like (recommend more like this)" onClick={() => onRate("like")}>👍</button>
            <button type="button" className={`ui-btn${rating === "dislike" ? " primary" : ""}`} disabled={busy} aria-pressed={rating === "dislike"} title="Dislike (recommend less like this)" onClick={() => onRate("dislike")}>👎</button>
            <button type="button" className="ui-btn" disabled={busy} onClick={() => act.later(playing, !queued)}>{queued ? "✓ Saved" : "Watch later"}</button>
            <button type="button" className="ui-btn" disabled={busy} title="Add this video's live chat to the Chat panel" onClick={onChat}>Chat</button>
            {link && <button type="button" className="ui-btn" onClick={() => void openUrl(link)}>Open on YouTube</button>}
            <button type="button" className="ui-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
      <aside className="yt-upnext" aria-label="Up next">
        <h4>Up next</h4>
        {next.length === 0 && <p className="ui-meta">Nothing queued: add channels and refresh.</p>}
        {next.map((c) => (
          <button key={c.videoId} type="button" className="yt-nextitem" title={c.title} onClick={() => act.play(c)}>
            <img className="yt-thumb" src={thumbUrl(c.videoId)} alt="" loading="lazy" />
            <span className="yt-meta"><span className="yt-ctitle">{c.title}</span><span className="ui-meta yt-by">{byLine(c)}</span></span>
          </button>
        ))}
      </aside>
    </div>
  );
}
