// Live view + Home "Live now" row: live/upcoming streams from your channels (checked on the
// button, or by the opt-in Auto-refresh), with Play and Watch live chat.
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "../../ui/kit";
import type { Card } from "./Cards";
import { thumbUrl } from "./panelLogic";
import { loadLive } from "./liveStore";
import type { LiveHit } from "./live";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

export function useLive(run: Run) {
  const [hits, setHits] = useState<LiveHit[]>([]);
  const reload = useCallback(() => void loadLive().then(setHits).catch(() => {}), []);
  useEffect(reload, [reload]);
  const check = async () => { await run("check_live"); reload(); };
  return { hits, check, reload };
}
export type YtLive = ReturnType<typeof useLive>;

const when = (h: LiveHit) => (h.status === "live" ? "LIVE" : h.startsAt ? `Starts ${new Date(h.startsAt * 1000).toLocaleString()}` : "Upcoming");

export function LiveView({ live, row, busy, named, onPlay, onChat }: {
  live: YtLive; row?: boolean; busy: boolean; named: (id: string | null) => string; onPlay(c: Card): void; onChat(c: Card): void;
}) {
  const list = row ? live.hits.filter((h) => h.status === "live") : live.hits;
  if (row && !list.length) return null;
  const card = (h: LiveHit): Card => ({ videoId: h.videoId, channelId: h.channelId, channel: named(h.channelId), title: h.title, meta: when(h) });
  return (
    <div className="yt-live">
      <div className="ui-controls"><h3 className="yt-h">{row ? "Live now" : "Live & upcoming"}</h3>
        {!row && <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void live.check()}>{busy ? "Checking…" : "Check now"}</button>}</div>
      {!list.length && <EmptyState title="Nobody is live" hint="Check now looks at each channel's /live page. Turn on Auto-refresh to check with the feeds." />}
      <div className="yt-row">{list.map((h) => { const c = card(h); return (
        <div key={h.videoId} className="yt-mini-card">
          <button type="button" title={h.title} onClick={() => onPlay(c)}>
            <img className="yt-thumb" src={thumbUrl(h.videoId)} alt="" loading="lazy" />
            <span className="yt-live-badge">{h.status === "live" ? "● LIVE" : "◷ UPCOMING"}</span>
            <span className="yt-ctitle">{h.title}</span><span className="ui-meta">{c.channel} · {c.meta}</span>
          </button>
          <button type="button" className="ui-link" disabled={busy} onClick={() => onChat(c)}>Watch live chat</button>
        </div>); })}</div>
    </div>
  );
}
