import { openUrl } from "@tauri-apps/plugin-opener";
import { safeLink } from "../../ui/safeLink";
import { embedUrl, watchUrl } from "./panelLogic";

// In-app playback via the privacy-enhanced embed; "Open on YouTube" uses the opener.
export function Player({ videoId, title, channel, onClose }: { videoId: string; title: string; channel: string; onClose: () => void }) {
  const src = embedUrl(videoId);
  const link = safeLink(watchUrl(videoId));
  return (
    <div className="yt-player">
      {src ? (
        <iframe
          key={videoId}
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}
      <div className="yt-player-bar">
        <span className="yt-text">
          <span className="yt-title">{title}</span>
          {channel && <span className="ui-meta">{channel}</span>}
        </span>
        {link && (
          <button type="button" className="ui-btn" onClick={() => void openUrl(link)}>Open on YouTube</button>
        )}
        <button type="button" className="ui-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
