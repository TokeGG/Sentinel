import { embedUrl } from "./panelLogic";

// In-app playback via the privacy-enhanced embed (actions live in WatchView).
export function Player({ videoId, title }: { videoId: string; title: string }) {
  const src = embedUrl(videoId);
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
    </div>
  );
}
