import { useEffect, useMemo, useRef } from "react";
import { listenMsg, parsePlayerMsg, playerUrl, rateMsg } from "./extras";

const YT = "https://www.youtube-nocookie.com";

// In-app playback via the privacy-enhanced embed with the IFrame JS API on, so the
// remembered speed can be applied (setPlaybackRate) and progress read (infoDelivery).
// Both depend on YouTube honouring postMessage in this webview: unverified on Windows.
export function Player({ videoId, title, rate = 1, start = 0, onProgress }: {
  videoId: string; title: string; rate?: number; start?: number; onProgress?: (time: number, duration: number) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const cb = useRef(onProgress);
  cb.current = onProgress;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const src = useMemo(() => playerUrl(videoId, { start, origin: location.origin }), [videoId]);
  const post = (m: string) => ref.current?.contentWindow?.postMessage(m, YT);
  useEffect(() => { post(rateMsg(rate)); }, [rate]);
  useEffect(() => {
    const last = { time: 0, duration: 0 };
    let saved = Date.now();
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const p = parsePlayerMsg(e.data);
      if (!p) return;
      if (p.duration) last.duration = p.duration;
      if (p.time !== undefined) last.time = p.time;
      if (Date.now() - saved > 15000) { saved = Date.now(); cb.current?.(last.time, last.duration); }
    };
    addEventListener("message", on);
    return () => { removeEventListener("message", on); if (last.time) cb.current?.(last.time, last.duration); };
  }, [videoId]);
  return (
    <div className="yt-player">
      {src ? (
        <iframe ref={ref} key={videoId} src={src} title={title} onLoad={() => { post(listenMsg()); post(rateMsg(rate)); }}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : null}
    </div>
  );
}
