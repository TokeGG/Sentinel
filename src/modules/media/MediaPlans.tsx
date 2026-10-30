// Media extras: merged New feed (stored rows + Twitch on button), watch-party countdown, streamer schedule.
import { useEffect, useState } from "react";
import { getDb } from "../../core/db";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { openLink } from "../../ui/openLink";
import { safeLink } from "../../ui/safeLink";
import { arrayOf, toCalendar, useJsonSetting } from "../../ui/useJsonSetting";
import { mergeNew, type NewItem } from "./newFeed";
import { countdown, dayTime, DAYS, nextWeekly, parsePartyText, partyText, validHHMM } from "./plan";
import type { LiveStream } from "./parsers";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

async function storedNew() {
  const d = await getDb();
  const yt = await d.select<{ video_id: string; title: string; published_at: string; channel_title: string }[]>(
    "SELECT v.video_id, v.title, v.published_at, c.title AS channel_title FROM youtube_videos v JOIN youtube_channels c ON c.channel_id = v.channel_id ORDER BY COALESCE(v.published_at, v.fetched_at) DESC LIMIT 60").catch(() => []);
  const pods = await d.select<{ id: number; title: string; published_at: string; audio_url: string; label: string }[]>(
    `SELECT i.id, i.title, i.published_at, e.url AS audio_url, s.label FROM news_items i JOIN news_enclosures e ON e.source_id = i.source_id AND e.guid = i.guid
     JOIN news_sources s ON s.id = i.source_id WHERE e.type LIKE 'audio%' ORDER BY COALESCE(i.published_at, i.fetched_at) DESC LIMIT 60`).catch(() => []);
  return { yt, pods };
}

export function NewFeed({ run }: { run: Run }) {
  const [base, setBase] = useState<Awaited<ReturnType<typeof storedNew>>>({ yt: [], pods: [] });
  const [live, setLive] = useState<LiveStream[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void storedNew().then(setBase); }, []); // local DB only; no network
  const items: NewItem[] = mergeNew(base.yt, live, base.pods);
  const open = (u: string) => { const l = safeLink(u); if (l) void openLink(l); };
  return (
    <div className="md-card">
      <button type="button" className="ui-btn ui-sm" onClick={() => void run("twitch_live").then((r) => { setLive((r as LiveStream[]) ?? []); setErr(null); }, (e) => setErr(String(e?.message ?? e)))}>Add Twitch live</button>
      {err && <ErrorLine message={err} />}
      {!items.length && <EmptyState title="Nothing new" hint="Refresh YouTube or News (podcasts) first." />}
      <ul className="md-list">
        {items.map((i) => <li key={i.key}><span className="md-dim">{i.kind}</span> <button type="button" className="ui-link" onClick={() => open(i.url)}>{i.title}</button> <span className="md-dim">{i.by}</span></li>)}
      </ul>
    </div>
  );
}

const isParty = (x: unknown): x is { title: string; start: number } => !!x && typeof (x as { start?: unknown }).start === "number";
export function WatchParty() {
  const [party, setParty] = useJsonSetting("media_party", (r) => (isParty(r) ? r : null));
  const [now, setNow] = useState(Date.now());
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const text = party ? partyText(party.title, party.start) : "";
  return (
    <div className="md-card">
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); const t = Date.parse(when) || parsePartyText(when); if (t) setParty({ title, start: t }); }}>
        <input placeholder="What are you watching?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Start (2026-10-30T20:00) or paste an invite" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Start time" />
        <button type="submit" className="ui-btn ui-sm">Set</button>
      </form>
      {party && <p><strong>{countdown(party.start, now)}</strong> <span className="md-dim">{text}</span>{" "}
        <button type="button" className="ui-btn ui-sm" onClick={() => void navigator.clipboard?.writeText(text)}>Copy invite</button>
        <button type="button" className="ui-btn ui-sm" onClick={() => setParty(null)}>Clear</button></p>}
    </div>
  );
}

interface Slot { streamer: string; dow: number; time: string }
const isSlot = (x: unknown): x is Slot => !!x && typeof (x as Slot).streamer === "string" && typeof (x as Slot).dow === "number" && validHHMM(String((x as Slot).time));
export function StreamerSchedule() {
  const [slots, setSlots] = useJsonSetting("media_streamer_sched", arrayOf(isSlot));
  const [f, setF] = useState<Slot>({ streamer: "", dow: 1, time: "19:00" });
  const [msg, setMsg] = useState("");
  const add = () => f.streamer.trim() && validHHMM(f.time) && setSlots([...slots, { ...f, streamer: f.streamer.trim().slice(0, 40) }]);
  const cal = (s: Slot) => void toCalendar({ title: `${s.streamer} stream`, ...dayTime(nextWeekly(s.dow, s.time, Date.now())), repeat: "weekly" }).then(() => setMsg(`Added ${s.streamer} to Calendar (weekly)`), (e) => setMsg(String(e?.message ?? e)));
  return (
    <div className="md-card">
      <div className="ui-controls">
        <input placeholder="Streamer" value={f.streamer} onChange={(e) => setF({ ...f, streamer: e.target.value })} />
        <select value={f.dow} aria-label="Day" onChange={(e) => setF({ ...f, dow: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
        <input type="time" value={f.time} aria-label="Time" onChange={(e) => setF({ ...f, time: e.target.value })} />
        <button type="button" className="ui-btn ui-sm" onClick={add}>Add</button>
      </div>
      {msg && <p className="md-dim">{msg}</p>}
      <ul className="md-list">
        {slots.map((s, i) => <li key={i}><strong>{s.streamer}</strong> <span className="md-dim">{DAYS[s.dow]} {s.time}</span>
          <button type="button" className="ui-btn ui-sm" onClick={() => cal(s)}>To calendar</button>
          <button type="button" className="ui-btn ui-sm" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>Remove</button></li>)}
      </ul>
    </div>
  );
}
