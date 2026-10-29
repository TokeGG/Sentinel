// Picture-in-picture style mini player: a small docked player inside the YouTube
// panel while browsing (resumes from the last saved position). Not a separate window.
import type { Card } from "./Cards";
import { Player } from "./Player";
import type { YtX } from "./useYtExtras";

export function MiniPlayer({ c, x, onExpand, onClose }: { c: Card; x: YtX; onExpand(): void; onClose(): void }) {
  return (
    <div className="yt-pip" role="region" aria-label="Mini player">
      <Player videoId={c.videoId} title={c.title} rate={(c.channelId && x.speed.get(c.channelId)) || 1} start={x.resumeAt(c.videoId)}
        onProgress={(t, d) => x.saveProgress({ videoId: c.videoId, channelId: c.channelId, title: c.title, seconds: t, duration: d })} />
      <div className="yt-pip-bar"><span className="yt-ctitle">{c.title}</span>
        <button type="button" className="ui-link" title="Expand" onClick={onExpand}>⤢</button>
        <button type="button" className="ui-link" title="Close mini player" onClick={onClose}>✕</button></div>
    </div>
  );
}
