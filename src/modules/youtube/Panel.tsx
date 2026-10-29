import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine, Tile, ago } from "../../ui/kit";
import { utcDate } from "../../ui/kit/format";
import { QuickAdd } from "../../ui/QuickAdd";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { HistoryTools } from "./HistoryTools";
import { Player } from "./Player";
import { recommend, splitRows } from "./panelLogic";
import { VideoList, type Item } from "./VideoList";
import "./youtube.css";

const age = (d: string | null) => (d ? ago(utcDate(d)) : "");
const dot = (...p: string[]) => p.filter(Boolean).join(" · ");

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const [playing, setPlaying] = useState<{ videoId: string; title: string; channel: string } | null>(null);
  const { videos, watched, channels } = splitRows(rows);
  const seen = new Set(watched.map((w) => w.videoId));
  const names = new Map(channels.map((c) => [c.channelId, c.title]));

  const play = (i: Item) => {
    setPlaying({ videoId: i.videoId, title: i.title, channel: i.channelId ? (names.get(i.channelId) ?? "") : "" });
    void run("mark_watched", { videoId: i.videoId, channelId: i.channelId, title: i.title });
  };
  const rec: Item[] = recommend(videos, watched).map((v) => ({ videoId: v.videoId, channelId: v.channelId, title: v.title, meta: dot(v.channel, age(v.publishedAt), v.why) }));
  const latest: Item[] = videos.slice(0, 40).map((v) => ({ videoId: v.videoId, channelId: v.channelId, title: v.title, meta: dot(v.channel, age(v.publishedAt)), dim: seen.has(v.videoId) }));
  const history: Item[] = watched.slice(0, 50).map((w) => ({ videoId: w.videoId, channelId: w.channelId, title: w.title, meta: dot(w.channelId ? (names.get(w.channelId) ?? "") : "", age(w.watchedAt)) }));

  return (
    <>
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{channels.length} ch</span>
      </h2>
      {error && <ErrorLine message={error} />}
      {playing && <Player {...playing} onClose={() => setPlaying(null)} />}
      <Sections>
        <Section id="add">
          <QuickAdd module={module} busy={busy} run={run} />
        </Section>
        <Section id="recommended">
          <Tile title="Recommended">
            {rec.length ? <VideoList items={rec} onPlay={play} /> : <EmptyState title="Nothing to recommend yet" hint="Add channels and refresh; picks improve as you watch." />}
          </Tile>
        </Section>
        <Section id="latest">
          <Tile title="Latest">
            {latest.length ? <VideoList items={latest} onPlay={play} /> : <EmptyState title="No videos yet" hint="Add a channel above, then press Refresh." />}
          </Tile>
        </Section>
        <Section id="channels">
          <Tile title="Channels">
            {channels.length === 0 ? (
              <EmptyState title="No channels" hint="Paste a channel URL, @handle or UC… id." />
            ) : (
              <div className="ui-list">
                {channels.map((c) => (
                  <div key={c.channelId} className="yt-chan">
                    <span className="yt-title">{c.title}</span>
                    {c.handle && <span className="ui-meta">{c.handle}</span>}
                    <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("remove_channel", { channelId: c.channelId })}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </Tile>
        </Section>
        <Section id="history">
          <Tile title="Watched">
            {history.length ? <VideoList items={history} onPlay={play} /> : <EmptyState title="No watch history" hint="Videos you play here are recorded locally. You can also import a Google Takeout watch-history.json." />}
            <HistoryTools busy={busy} run={run} count={watched.length} />
          </Tile>
        </Section>
        <Section id="status">
          <div className="ui-controls">
            <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void run("refresh_feeds")}>
              {busy ? "Working…" : "Refresh"}
            </button>
            <ScheduleToggle module={module} />
          </div>
        </Section>
      </Sections>
    </>
  );
}
