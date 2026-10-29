// Body of the pop-out player panel (hub.ytplayer): plays the shared queue, autoplays the
// next item when the IFrame reports state 0, keeps 16:9 by correcting the panel height
// after a grip resize, and keeps playing when the YouTube panel is closed.
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { closePanel, commit, dragResize, getPanel, YTPLAYER_ID } from "../../shell/panelApi";
import { panelLabel } from "../../shell/panelEvents";
import { getSetting, setSetting } from "../../ui/appSetting";
import { saveProgress } from "./extrasStore";
import { Player } from "./Player";
import { current, EMPTY, hasNext, hasPrev, lockedPanelH, QUEUE_EVENT, QUEUE_KEY, sanitizeQueue, step, withAt, type Queue } from "./queue";
import "./youtube.css";

const persist = (q: Queue) => void setSetting(QUEUE_KEY, JSON.stringify(q)).catch(() => {});

export default function PopPlayer() {
  const [q, setQ] = useState<Queue>(EMPTY);
  const qRef = useRef(q);
  qRef.current = q;
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    getSetting(QUEUE_KEY).then((v) => setQ(sanitizeQueue(v))).catch(() => {});
    const un = listen(QUEUE_EVENT, ({ payload }) => setQ(sanitizeQueue(payload)), { target: panelLabel(YTPLAYER_ID) });
    return () => void un.then((f) => f()).catch(() => {});
  }, []);
  useEffect(() => { // 16:9 lock: after resizing settles, fix the height to match the width
    let t = 0;
    const fix = async () => {
      const p = await getPanel(YTPLAYER_ID);
      const h = lockedPanelH(p.rect.h, innerWidth, innerHeight, bar.current?.offsetHeight ?? 0);
      if (Math.abs(h - p.rect.h) > 3) { await dragResize(YTPLAYER_ID, p.rect.w, h); await commit(await getPanel(YTPLAYER_ID)); }
    };
    const on = () => { clearTimeout(t); t = window.setTimeout(() => void fix().catch(() => {}), 500); };
    addEventListener("resize", on);
    on();
    return () => { clearTimeout(t); removeEventListener("resize", on); };
  }, []);
  const go = (d: 1 | -1) => { const n = step(qRef.current, d); setQ(n); persist(n); };
  const c = current(q);
  return (
    <div className="ytp">
      {c ? (
        <Player key={`${q.index}:${c.videoId}`} videoId={c.videoId} title={c.title} start={q.at}
          onEnded={() => hasNext(qRef.current) && go(1)}
          onProgress={(t, d) => { persist(withAt(qRef.current, t)); void saveProgress({ videoId: c.videoId, channelId: c.channelId, title: c.title, seconds: t, duration: d }).catch(() => {}); }} />
      ) : <p className="ui-meta">Nothing queued: pop a video out from the YouTube panel.</p>}
      <div ref={bar} className="ytp-bar">
        <button type="button" className="ui-link" title="Previous" disabled={!hasPrev(q)} onClick={() => go(-1)}>⏮</button>
        <button type="button" className="ui-link" title="Next" disabled={!hasNext(q)} onClick={() => go(1)}>⏭</button>
        <span className="yt-ctitle" title={c?.title}>{c?.title ?? ""}{q.items.length > 1 ? ` (${q.index + 1}/${q.items.length})` : ""}</span>
        <button type="button" className="ui-link" title="Close player" onClick={() => void closePanel(YTPLAYER_ID)}>✕</button>
      </div>
    </div>
  );
}
