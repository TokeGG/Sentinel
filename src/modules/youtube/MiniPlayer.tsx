// Picture-in-picture style mini player docked inside the YouTube panel (resumes from the
// last saved position). Drag its bar out of the panel, or press ⧉, to pop it out into its
// own floating panel (hub.ytplayer) that keeps playing when this panel closes.
import type { DragEvent } from "react";
import type { Card } from "./Cards";
import { Player } from "./Player";
import type { YtX } from "./useYtExtras";

const outside = (e: DragEvent) => e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight;

export function MiniPlayer({ c, x, onExpand, onClose, onPop }: { c: Card; x: YtX; onExpand(): void; onClose(): void; onPop(): void }) {
  return (
    <div className="yt-pip" role="region" aria-label="Mini player">
      <Player videoId={c.videoId} title={c.title} rate={(c.channelId && x.speed.get(c.channelId)) || 1} start={x.resumeAt(c.videoId)}
        onProgress={(t, d) => x.saveProgress({ videoId: c.videoId, channelId: c.channelId, title: c.title, seconds: t, duration: d })} />
      <div className="yt-pip-bar" draggable title="Drag out of the panel to pop out"
        onDragStart={(e) => e.dataTransfer.setData("text/plain", c.title)} onDragEnd={(e) => outside(e) && onPop()}>
        <span className="yt-ctitle">{c.title}</span>
        <button type="button" className="ui-link" title="Pop out (own floating player)" onClick={onPop}>⧉</button>
        <button type="button" className="ui-link" title="Expand" onClick={onExpand}>⤢</button>
        <button type="button" className="ui-link" title="Close mini player" onClick={onClose}>✕</button></div>
    </div>
  );
}
