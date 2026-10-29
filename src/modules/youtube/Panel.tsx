import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { Chip, EmptyState, ErrorLine } from "../../ui/kit";
import { QuickAdd } from "../../ui/QuickAdd";
import { TasteBar } from "../../ui/TasteBar";
import { Section, Sections } from "../../ui/useCustomize";
import { CardGrid } from "./Cards";
import { ChannelsView } from "./ChannelsView";
import { HistoryTools } from "./HistoryTools";
import { ContinueRow, LaterTray } from "./HomeExtras";
import { MiniPlayer } from "./MiniPlayer";
import { LiveView } from "./LiveView";
import { PlaylistsView } from "./PlaylistsView";
import { Side } from "./Side";
import { total } from "./extras";
import { useYt } from "./useYt";
import { chipsFor } from "./viewLogic";
import { WatchView } from "./WatchView";
import "./youtube.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const y = useYt(module);
  const { d, x, view, busy, run, act, queue, q } = y;
  const home = view === "home";
  const watching = view === "watch" && y.playing;
  const chips = [...chipsFor(d.channels), ...[...x.groups.keys()].map((g) => ({ id: `grp:${g}`, label: `▦ ${g}` }))];

  return (
    <div className="yt">
      <header className="yt-top">
        <h2 className="ui-head"><span className="ui-dot" />{module.name}<span className="ui-count">{d.channels.length} ch</span></h2>
        <input className="yt-search" type="search" value={y.query} placeholder="Search videos" aria-label="Search" onChange={(e) => { y.setQuery(e.target.value); if (view === "watch" || view === "subs") y.setView("home"); }} />
        <Section id="add"><QuickAdd module={module} busy={busy} run={run} /></Section>
      </header>
      {(y.error || y.note) && <ErrorLine message={y.error ?? y.note ?? ""} />}
      <div className="yt-body">
        <Side view={view} counts={{ live: y.live.hits.filter((h) => h.status === "live").length, later: d.later.length, playlists: x.playlists.length, history: d.watched.length, subs: total(x.uploads) || d.channels.length }} onGo={y.go} />
        <main className="yt-main">
          {watching ? (
            <WatchView playing={y.playing!} next={y.next} queue={queue} rating={y.rating} busy={busy} act={act} onRate={y.rate} onChat={() => void y.chat()} x={x}
              onClose={() => y.go("home")} onPop={() => y.pop(y.playing!)} onMini={() => { y.setMini(true); y.go("home"); }} />
          ) : (
            <Sections className="yt-sections">
              <Section id="chips">
                {home && (
                  <div className="yt-chips" role="toolbar" aria-label="Filter">
                    {chips.map((c) => { const n = c.id.startsWith("ch:") ? x.uploads.get(c.id.slice(3)) : 0; return <Chip key={c.id} on={y.chip === c.id} onClick={() => y.setChip(c.id)}>{c.label}{n ? ` • ${n}` : ""}</Chip>; })}
                  </div>
                )}
              </Section>
              <Section id="live">
                {(view === "live" || (home && y.chip === "all" && !q)) && <LiveView live={y.live} row={home} busy={busy} named={y.named} onPlay={act.play} onChat={(c) => void y.chat(c)} />}
              </Section>
              <Section id="continue">
                {home && y.chip === "all" && !q && <ContinueRow items={x.cont} act={act} named={y.named} onDrop={x.dropProgress} />}
              </Section>
              <Section id="recommended">
                {home && y.chip === "all" && !q && y.recCards.length > 0 && (<><div className="ui-controls"><h3 className="yt-h">Recommended</h3><TasteBar taste={y.taste} name="YouTube" forYou={y.forYou} onForYou={y.setForYou} /></div><CardGrid cards={y.recCards} queue={queue} act={act} /></>)}
              </Section>
              <Section id="latest">
                {home && (y.latest.length ? (<><h3 className="yt-h">Latest</h3><CardGrid cards={y.latest} queue={queue} act={act} /></>) : <EmptyState title={q ? "No matches" : "No videos yet"} hint="Use Add channel by link, then press Refresh." />)}
              </Section>
              <Section id="later">
                {view === "later" && (y.laterCards.length ? <CardGrid cards={y.laterCards} queue={queue} act={act} /> : <EmptyState title="Watch later is empty" hint="Use the clock on any video." />)}
              </Section>
              <Section id="playlists">
                {view === "playlists" && <PlaylistsView x={x} queue={queue} act={act} named={y.named} />}
              </Section>
              <Section id="channels">
                {view === "subs" && (<>
                  {total(x.uploads) > 0 && <button type="button" className="ui-btn" onClick={() => x.markSeen()}>Mark all uploads seen</button>}
                  <ChannelsView channels={d.channels} signals={d.signals} busy={busy} run={run} groups={x.groupRows} uploads={x.uploads} onGroup={x.setGroup} onOpen={(id) => { y.setChip(`ch:${id}`); y.go("home"); }} />
                </>)}
              </Section>
              <Section id="history">
                {view === "history" && (<>
                  {y.historyCards.length ? <CardGrid cards={y.historyCards} queue={queue} act={act} /> : <EmptyState title="No watch history" hint="Videos you play are recorded locally, once each. You can also import a Takeout watch-history.json." />}
                  <HistoryTools busy={busy} run={run} count={d.watched.length} />
                </>)}
              </Section>
              <Section id="status">
                {home && (
                  <div className="ui-controls">
                    <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void run("refresh_feeds")}>{busy ? "Working…" : "Refresh"}</button>
                    <ScheduleToggle module={module} />
                  </div>
                )}
              </Section>
              <Section id="tray">{view !== "later" && <LaterTray cards={y.laterCards} act={act} />}</Section>
            </Sections>
          )}
        </main>
      </div>
      {y.mini && y.playing && !watching && <MiniPlayer c={y.playing} x={x} onExpand={() => { y.setMini(false); y.go("watch"); }} onClose={() => y.setMini(false)} onPop={() => y.pop(y.playing!)} />}
    </div>
  );
}
