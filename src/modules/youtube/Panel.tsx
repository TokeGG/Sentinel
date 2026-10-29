import { emit } from "@tauri-apps/api/event";
import { useMemo, useState } from "react";
import { registry, type ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { openPanel } from "../../shell/panelApi";
import { Chip, EmptyState, ErrorLine, ago } from "../../ui/kit";
import { utcDate } from "../../ui/kit/format";
import { findSkill } from "../../ui/moduleRun";
import { QuickAdd } from "../../ui/QuickAdd";
import { score } from "../../core/taste/model";
import { useTaste } from "../../core/taste/useTaste";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { CardGrid, type Card, type CardActions } from "./Cards";
import { ChannelsView } from "./ChannelsView";
import { HistoryTools } from "./HistoryTools";
import { ratingOf } from "./library";
import { recommend, type Video } from "./recommend";
import { Side } from "./Side";
import { splitRows, watchUrl } from "./panelLogic";
import { agoLabel, chipsFor, filterVideos, matchWatched, upNext, type View } from "./viewLogic";
import { videoTaste } from "./taste";
import { WatchView } from "./WatchView";
import "./youtube.css";

const age = (d: string | null) => (d ? agoLabel(ago(utcDate(d))) : "");

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const [view, setView] = useState<View>("home");
  const [chip, setChip] = useState("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<Card | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const taste = useTaste(module.id);
  const d = useMemo(() => splitRows(rows), [rows]);
  const seen = useMemo(() => new Set(d.watched.map((w) => w.videoId)), [d.watched]);
  const queue = useMemo(() => new Set(d.later.map((l) => l.videoId)), [d.later]);
  const names = useMemo(() => new Map(d.channels.map((c) => [c.channelId, c.title])), [d.channels]);

  const card = (v: Video): Card => ({ videoId: v.videoId, channelId: v.channelId, channel: v.channel, title: v.title, meta: age(v.publishedAt), dim: seen.has(v.videoId) });
  const rec = useMemo(() => recommend(d.videos, d.watched, Date.now(), 8, d.signals, taste.off ? undefined : (v) => 1.5 * score(videoTaste(v), taste.profile)), [d, taste.profile, taste.off]);
  const latest = filterVideos(d.videos, { chip, query, seen, signals: d.signals }).slice(0, 60).map(card);
  const q = query.trim().toLowerCase();
  const byQuery = (c: Card) => !q || c.title.toLowerCase().includes(q) || c.channel.toLowerCase().includes(q);
  const named = (id: string | null) => (id ? (names.get(id) ?? "") : "");
  const laterCards: Card[] = d.later.map((l) => ({ videoId: l.videoId, channelId: l.channelId, channel: named(l.channelId), title: l.title, meta: age(l.addedAt) && `saved ${age(l.addedAt)}` })).filter(byQuery);
  const historyCards: Card[] = matchWatched(d.watched, query).slice(0, 120).map((w) => ({
    videoId: w.videoId, channelId: w.channelId, channel: named(w.channelId), title: w.title,
    meta: [age(w.watchedAt), w.count > 1 ? `watched ${w.count}×` : ""].filter(Boolean).join(" · "),
  }));

  const sig = (kind: "video" | "channel", id: string, signal: string, c: Card) => {
    void taste.record(videoTaste(c), signal === "like" ? "like" : signal === "dislike" ? "dislike" : "dismiss");
    void run("set_signal", { kind, id, signal, channelId: c.channelId, title: kind === "channel" ? c.channel : c.title });
  };
  const act: CardActions = {
    play: (c) => { void taste.record(videoTaste(c), "open"); setPlaying(c); setView("watch"); void run("mark_watched", { videoId: c.videoId, channelId: c.channelId, title: c.title }); },
    later: (c, on) => void run(on ? "add_later" : "remove_later", { videoId: c.videoId, channelId: c.channelId, title: c.title }),
    notInterested: (c) => sig("video", c.videoId, "hide", c),
    hideChannel: (c) => c.channelId && sig("channel", c.channelId, "hide", c),
  };
  const rate = (r: "like" | "dislike") => {
    if (!playing) return;
    if (ratingOf(d.signals, playing.videoId) === r) void run("clear_signal", { kind: "video", id: playing.videoId, signal: r });
    else sig("video", playing.videoId, r, playing);
  };
  async function chat() {
    const chatMod = registry.find((m) => m.id === "hub.chat");
    if (!chatMod || !playing) return setNote("The Chat module is not available");
    try {
      setNote(null);
      const out = (await findSkill(chatMod, "add_room").run({ input: watchUrl(playing.videoId), site: "youtube", label: `YT ${playing.title.slice(0, 24)}` })) as { id?: string };
      await emit("chat-rooms-changed", { id: out?.id });
      await openPanel(chatMod);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  }
  const go = (v: View) => { setView(v); setNote(null); };
  const watching = view === "watch" && playing;
  const visible = filterVideos(d.videos, { chip: "all", query: "", seen, signals: d.signals });
  const next = playing ? upNext(playing.videoId, rec, visible, seen).map(card) : [];

  return (
    <div className="yt">
      <header className="yt-top">
        <h2 className="ui-head"><span className="ui-dot" />{module.name}<span className="ui-count">{d.channels.length} ch</span></h2>
        <input className="yt-search" type="search" value={query} placeholder="Search videos" aria-label="Search" onChange={(e) => { setQuery(e.target.value); if (view === "watch" || view === "subs") setView("home"); }} />
        <Section id="add"><QuickAdd module={module} busy={busy} run={run} /></Section>
      </header>
      {(error || note) && <ErrorLine message={error ?? note ?? ""} />}
      <div className="yt-body">
        <Side view={view} counts={{ later: d.later.length, history: d.watched.length, subs: d.channels.length }} onGo={go} />
        <main className="yt-main">
          {watching ? (
            <WatchView playing={playing} next={next} queue={queue} rating={ratingOf(d.signals, playing.videoId)} busy={busy} act={act} onRate={rate} onChat={() => void chat()} onClose={() => go("home")} />
          ) : (
            <Sections className="yt-sections">
              <Section id="chips">
                {view === "home" && (
                  <div className="yt-chips" role="toolbar" aria-label="Filter">
                    {chipsFor(d.channels).map((c) => <Chip key={c.id} on={chip === c.id} onClick={() => setChip(c.id)}>{c.label}</Chip>)}
                  </div>
                )}
              </Section>
              <Section id="recommended">
                {view === "home" && chip === "all" && !q && rec.length > 0 && (<><h3 className="yt-h">Recommended</h3><CardGrid cards={rec.map((v) => ({ ...card(v), meta: `${age(v.publishedAt)} · ${v.why}` }))} queue={queue} act={act} /></>)}
              </Section>
              <Section id="latest">
                {view === "home" && (latest.length ? (<><h3 className="yt-h">Latest</h3><CardGrid cards={latest} queue={queue} act={act} /></>) : <EmptyState title={q ? "No matches" : "No videos yet"} hint="Use Add channel by link, then press Refresh." />)}
              </Section>
              <Section id="later">
                {view === "later" && (laterCards.length ? <CardGrid cards={laterCards} queue={queue} act={act} /> : <EmptyState title="Watch later is empty" hint="Use the clock on any video." />)}
              </Section>
              <Section id="channels">
                {view === "subs" && <ChannelsView channels={d.channels} signals={d.signals} busy={busy} run={run} onOpen={(id) => { setChip(`ch:${id}`); go("home"); }} />}
              </Section>
              <Section id="history">
                {view === "history" && (<>
                  {historyCards.length ? <CardGrid cards={historyCards} queue={queue} act={act} /> : <EmptyState title="No watch history" hint="Videos you play are recorded locally, once each. You can also import a Takeout watch-history.json." />}
                  <HistoryTools busy={busy} run={run} count={d.watched.length} />
                </>)}
              </Section>
              <Section id="status">
                {view === "home" && (
                  <div className="ui-controls">
                    <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void run("refresh_feeds")}>{busy ? "Working…" : "Refresh"}</button>
                    <ScheduleToggle module={module} />
                  </div>
                )}
              </Section>
            </Sections>
          )}
        </main>
      </div>
    </div>
  );
}
