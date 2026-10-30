// CS2 section: HLTV headlines from already-fetched News rows, manual match reminders -> Calendar,
// live badge only from the entered start time (no extra requests).
import { useEffect, useState } from "react";
import { getDb } from "../../core/db";
import { openLink } from "../../ui/openLink";
import { safeLink } from "../../ui/safeLink";
import { arrayOf, toCalendar, useJsonSetting } from "../../ui/useJsonSetting";
import { useOption } from "../../ui/useOption";
import { dayTime } from "../media/plan";
import { hltvRows, isMatch, matchList, type Match } from "./cs2Logic";

export function Cs2() {
  const hours = useOption("matchHours", 3);
  const [matches, setMatches] = useJsonSetting("cs2_matches", arrayOf(isMatch));
  const [news, setNews] = useState<{ id: number; title: string; link: string }[]>([]);
  const [f, setF] = useState({ teams: "", event: "", when: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    void getDb().then((d) => d.select<{ id: number; title: string; link: string; source_url: string }[]>(
      "SELECT i.id, i.title, i.link, s.url AS source_url FROM news_items i JOIN news_sources s ON s.id = i.source_id WHERE s.url LIKE '%hltv.org%' OR i.link LIKE '%hltv.org%' ORDER BY COALESCE(i.published_at, i.fetched_at) DESC LIMIT 30"))
      .then((r) => setNews(hltvRows(r))).catch(() => {});
  }, []);
  const add = () => {
    const start = Date.parse(f.when);
    if (!f.teams.trim() || !Number.isFinite(start)) return setMsg("Enter teams and a start time.");
    setMatches([...matches, { id: String(Date.now()), teams: f.teams.trim().slice(0, 80), event: f.event.trim().slice(0, 80), start }]);
    setF({ teams: "", event: "", when: "" }); setMsg("");
  };
  const cal = (m: Match) => void toCalendar({ title: `CS2: ${m.teams}`, ...dayTime(m.start), notes: m.event }).then(() => setMsg("Added to Calendar"), (e) => setMsg(String(e?.message ?? e)));
  return (
    <div className="gm-cs2">
      <h3>Matches</h3>
      <div className="ui-controls">
        <input placeholder="Team A vs Team B" value={f.teams} onChange={(e) => setF({ ...f, teams: e.target.value })} />
        <input placeholder="Event" value={f.event} onChange={(e) => setF({ ...f, event: e.target.value })} />
        <input type="datetime-local" aria-label="Match start" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} />
        <button type="button" className="ui-btn ui-sm" onClick={add}>Add reminder</button>
      </div>
      {msg && <p className="gm-dim">{msg}</p>}
      <ul className="gm-news">
        {matchList(matches, hours, Date.now()).map((m) => (
          <li key={m.id}>{m.live && <span className="nw-badge">LIVE</span>} <strong>{m.teams}</strong> <span className="gm-dim">{m.event} · {new Date(m.start).toLocaleString()}</span>
            <button type="button" className="ui-btn ui-sm" onClick={() => cal(m)}>To calendar</button>
            <button type="button" className="ui-btn ui-sm" onClick={() => setMatches(matches.filter((x) => x.id !== m.id))}>Remove</button></li>
        ))}
      </ul>
      <h3>HLTV news</h3>
      {!news.length && <p className="gm-dim">Enable the “HLTV (CS2)” source in News › Sources and fetch.</p>}
      <ul className="gm-news">
        {news.map((n) => { const l = safeLink(n.link); return <li key={n.id}>{l ? <button type="button" className="ui-link" onClick={() => void openLink(l)}>{n.title}</button> : n.title}</li>; })}
      </ul>
    </div>
  );
}
