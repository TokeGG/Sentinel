import { useState } from "react";
import { openLink as openUrl } from "../../ui/openLink"; // in-app browser or system (links_open_in)
import { EmptyState, ErrorLine } from "../../ui/kit";
import type { NowPlaying } from "./api";
import type { LiveStream, Score } from "./parsers";
import { uptime } from "./panelLogic";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

/** Loads a skill result on button press only (no fetch on mount). */
export function useOnDemand<T>(run: Run, skill: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = (args?: Record<string, unknown>) => run(skill, args).then((r) => { setData((r as T) ?? null); setErr(null); }, (e) => setErr(String(e?.message ?? e)));
  return { data, err, load };
}

export function NowPlayingCard({ run }: { run: Run }) {
  const np = useOnDemand<NowPlaying>(run, "now_playing");
  const d = np.data;
  return (
    <div className="md-card">
      {d?.available ? <p><strong>{d.title}</strong> · {d.artist} <span className="md-dim">{d.app}</span></p>
        : <p className="md-dim">{d ? d.reason : "Check what Windows is playing."}</p>}
      <button type="button" className="ui-btn ui-sm" onClick={() => void np.load()}>Check</button>
    </div>
  );
}

export function TwitchLive({ run }: { run: Run }) {
  const tw = useOnDemand<LiveStream[]>(run, "twitch_live");
  return (
    <div className="md-card">
      <button type="button" className="ui-btn ui-sm" onClick={() => void tw.load()}>Load live channels</button>
      {tw.err && <ErrorLine message={tw.err} />}
      {tw.data && !tw.data.length && <EmptyState title="Nobody you follow is live" />}
      <ul className="md-list">
        {(tw.data ?? []).map((s) => (
          <li key={s.login}>
            <span className="md-live" aria-hidden="true" /> <strong>{s.name}</strong> <span className="md-dim">{s.game} · {s.viewers} · {uptime(s.startedAt)}</span>
            <div className="md-dim md-clip">{s.title}</div>
            <button type="button" className="ui-btn ui-sm" onClick={() => void run("watch_in_chat", { login: s.login })}>Chat</button>
            <button type="button" className="ui-btn ui-sm" onClick={() => void openUrl(`https://www.twitch.tv/${s.login}`)}>Browser</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sports({ run, league }: { run: Run; league: string }) {
  const sp = useOnDemand<Score[]>(run, "sports_scores");
  return (
    <div className="md-card">
      <button type="button" className="ui-btn ui-sm" onClick={() => void sp.load({ leagues: [league] })}>Load {league.toUpperCase()} scores</button>
      {sp.err && <ErrorLine message={sp.err} />}
      <div className="md-ticker">
        {(sp.data ?? []).map((g) => (
          <span key={g.id} className={`md-score${g.live ? " live" : ""}`}>{g.away} {g.awayScore} @ {g.home} {g.homeScore} <span className="md-dim">{g.status}</span></span>
        ))}
      </div>
    </div>
  );
}
