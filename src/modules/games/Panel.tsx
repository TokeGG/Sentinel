import { useEffect, useState } from "react";
import { openLink as openUrl } from "../../ui/openLink"; // in-app browser or system (links_open_in)
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { safeLink } from "../../ui/safeLink";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import type { NewsRow } from "./library";
import { filterGames, playedText, recentGames, type Game } from "./panelLogic";
import "./games.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const games = rows as unknown as Game[];
  const [q, setQ] = useState("");
  const [fav, setFav] = useState(false);
  const [news, setNews] = useState<NewsRow[]>([]);
  const loadNews = () => void run("list_news").then((r) => setNews((r as NewsRow[]) ?? []));
  useEffect(loadNews, [run]);
  const names = new Map(games.map((g) => [g.appid, g.name]));
  const card = (g: Game) => (
    <article key={g.key} className="gm-card">
      <span className="gm-store">{g.store}</span>
      <h3>{g.name}</h3>
      <p className="gm-dim">Played {playedText(g.lastPlayed)}</p>
      <div className="ui-controls">
        <button type="button" className="ui-btn primary ui-sm" disabled={busy} onClick={() => void run("launch", { key: g.key })}>Play</button>
        <button type="button" className="ui-btn ui-sm" aria-pressed={g.favorite} disabled={busy} onClick={() => void run("toggle_favorite", { key: g.key })}>{g.favorite ? "★" : "☆"}</button>
      </div>
    </article>
  );
  const list = filterGames(games, q, fav);
  return (
    <div className="gm">
      <h2 className="ui-head"><span className="ui-dot" />{module.name}<span className="ui-count">{games.length}</span></h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="recent">
          <div className="gm-grid">{recentGames(games).map(card)}</div>
        </Section>
        <Section id="library">
          <div className="ui-controls">
            <input placeholder="Filter games…" value={q} onChange={(e) => setQ(e.target.value)} />
            <label><input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} /> Favourites</label>
          </div>
          {list.length ? <div className="gm-grid">{list.map(card)}</div>
            : <EmptyState title="No games found" hint="Steam and Epic installs are read on Windows only." />}
        </Section>
        <Section id="news">
          {news.length ? (
            <ul className="gm-news">
              {news.map((n) => (
                <li key={n.appid + n.guid} className={n.seen ? "" : "new"}>
                  <span className="gm-dim">{names.get(n.appid) ?? n.appid}</span>{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); const u = safeLink(n.link); if (u) void openUrl(u); }}>{n.title}</a>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No patch notes yet" hint="Favourite or play a Steam game, then Check patch notes." />}
        </Section>
        <Section id="actions">
          <div className="ui-controls">
            <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void run("refresh_news").then(loadNews)}>Check patch notes</button>
            <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("mark_news_seen").then(loadNews)}>Mark notes read</button>
            <ScheduleToggle module={module} />
          </div>
        </Section>
      </Sections>
    </div>
  );
}
