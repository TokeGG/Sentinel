// Pure parsers for the Media panel's key-less/public JSON sources (Twitch Helix, TVmaze, ESPN).
type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" ? (v as J) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface LiveStream { login: string; name: string; game: string; title: string; viewers: number; startedAt: string }
export const followedUrl = (userId: string) => `https://api.twitch.tv/helix/streams/followed?user_id=${encodeURIComponent(userId)}&first=100`;

/** Helix /streams/followed -> live streams, most viewers first. */
export function parseFollowed(j: unknown): LiveStream[] {
  return arr(obj(j).data).map(obj).filter((s) => str(s.user_login))
    .map((s) => ({ login: str(s.user_login), name: str(s.user_name) || str(s.user_login), game: str(s.game_name), title: str(s.title), viewers: Number(s.viewer_count) || 0, startedAt: str(s.started_at) }))
    .sort((a, b) => b.viewers - a.viewers);
}

export interface ShowHit { id: number; name: string; premiered: string; network: string }
export const tvmazeSearchUrl = (q: string) => `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
export const tvmazeShowUrl = (id: number) => `https://api.tvmaze.com/shows/${id}?embed=nextepisode`;

export function parseShowSearch(j: unknown): ShowHit[] {
  return arr(j).map((h) => obj(obj(h).show)).filter((s) => Number.isInteger(s.id) && str(s.name))
    .map((s) => ({ id: s.id as number, name: str(s.name), premiered: str(s.premiered), network: str(obj(s.network).name || obj(s.webChannel).name) }));
}

/** /shows/<id>?embed=nextepisode -> next airing day + label, or nulls when none is announced. */
export function parseNextEpisode(j: unknown): { day: string | null; label: string } {
  const e = obj(obj(obj(j)._embedded).nextepisode);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(str(e.airdate)) ? str(e.airdate) : null;
  if (!day) return { day: null, label: "" };
  const se = Number.isInteger(e.season) && Number.isInteger(e.number) ? `S${String(e.season).padStart(2, "0")}E${String(e.number).padStart(2, "0")} ` : "";
  return { day, label: `${se}${str(e.name)}`.trim() };
}

export const LEAGUES: Record<string, string> = { nfl: "football/nfl", nba: "basketball/nba", mlb: "baseball/mlb", nhl: "hockey/nhl", epl: "soccer/eng.1", mls: "soccer/usa.1" };
export const scoreboardUrl = (league: string): string | null => (LEAGUES[league] ? `https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[league]}/scoreboard` : null);

export interface Score { id: string; league: string; home: string; away: string; homeScore: string; awayScore: string; status: string; live: boolean }

export function parseScoreboard(j: unknown, league: string): Score[] {
  return arr(obj(j).events).map(obj).flatMap((ev) => {
    const c = obj(arr(ev.competitions)[0]);
    const teams = arr(c.competitors).map(obj);
    const side = (h: string) => teams.find((t) => t.homeAway === h);
    const home = side("home"), away = side("away");
    if (!home || !away) return [];
    const name = (t: J) => str(obj(t.team).abbreviation) || str(obj(t.team).displayName);
    const st = obj(obj(ev.status || c.status).type);
    return [{ id: str(ev.id), league, home: name(home), away: name(away), homeScore: str(home.score), awayScore: str(away.score), status: str(st.shortDetail) || str(st.description), live: st.state === "in" }];
  });
}
