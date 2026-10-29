import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { followedUrl, parseFollowed, parseNextEpisode, parseScoreboard, parseShowSearch, scoreboardUrl, tvmazeSearchUrl } from "./parsers.ts";
import { airsIn, imagePage, isImage, joinPath, mediaSections, uptime } from "./panelLogic.ts";

const HELIX = { data: [
  { user_login: "a", user_name: "A", game_name: "Chess", title: "t1", viewer_count: 5, started_at: "2026-10-29T10:00:00Z" },
  { user_login: "b", user_name: "", game_name: "Go", title: "t2", viewer_count: 50, started_at: "2026-10-29T11:00:00Z" },
  { user_name: "nologin" }] };
const SEARCH = [{ score: 1, show: { id: 82, name: "Game of Thrones", premiered: "2011-04-17", network: { name: "HBO" } } }, { show: { name: "no id" } }];
const SHOW = { id: 82, _embedded: { nextepisode: { airdate: "2026-11-02", season: 2, number: 5, name: "Pilot" } } };
const ESPN = { events: [
  { id: "1", status: { type: { state: "in", shortDetail: "Q3 4:12" } }, competitions: [{ competitors: [
    { homeAway: "home", score: "21", team: { abbreviation: "KC" } }, { homeAway: "away", score: "14", team: { abbreviation: "BUF" } }] }] },
  { id: "2", competitions: [{ competitors: [] }] }] };

describe("media parsers", () => {
  it("twitch followed", () => {
    assert.deepEqual(parseFollowed(HELIX).map((s) => [s.login, s.name, s.viewers]), [["b", "b", 50], ["a", "A", 5]]);
    assert.deepEqual(parseFollowed(null), []);
    assert.match(followedUrl("12 3"), /user_id=12%203/);
  });
  it("tvmaze", () => {
    assert.deepEqual(parseShowSearch(SEARCH), [{ id: 82, name: "Game of Thrones", premiered: "2011-04-17", network: "HBO" }]);
    assert.deepEqual(parseNextEpisode(SHOW), { day: "2026-11-02", label: "S02E05 Pilot" });
    assert.deepEqual(parseNextEpisode({ id: 1 }), { day: null, label: "" });
    assert.equal(tvmazeSearchUrl("a b"), "https://api.tvmaze.com/search/shows?q=a%20b");
  });
  it("espn", () => {
    assert.deepEqual(parseScoreboard(ESPN, "nfl"), [{ id: "1", league: "nfl", home: "KC", away: "BUF", homeScore: "21", awayScore: "14", status: "Q3 4:12", live: true }]);
    assert.equal(scoreboardUrl("nba"), "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
    assert.equal(scoreboardUrl("x"), null);
  });
});

describe("media panelLogic", () => {
  it("images", () => {
    assert.ok(isImage("a.JPEG") && !isImage("a.txt"));
    const files = [{ name: "b.png", modified: 1 }, { name: "a.gif", modified: 2 }, { name: "c.txt", modified: 3 }];
    assert.deepEqual(imagePage(files, 0), { names: ["a.gif", "b.png"], pages: 1 });
    assert.deepEqual(imagePage(files, 9, 1), { names: ["b.png"], pages: 2 });
    assert.equal(joinPath("C:\\m", "x.png"), "C:\\m\\x.png");
    assert.equal(joinPath("/m/", "x.png"), "/m/x.png");
  });
  it("airsIn + uptime", () => {
    assert.equal(airsIn(null, "2026-10-29"), "no date");
    assert.equal(airsIn("2026-10-28", "2026-10-29"), "aired");
    assert.equal(airsIn("2026-10-29", "2026-10-29"), "today");
    assert.equal(airsIn("2026-10-30", "2026-10-29"), "tomorrow");
    assert.equal(airsIn("2026-11-01", "2026-10-29"), "in 3 days");
    assert.equal(uptime("2026-10-29T10:00:00Z", Date.parse("2026-10-29T11:05:00Z")), "1h 5m");
    assert.equal(uptime("bad"), "");
  });
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, mediaSections.map((s) => s.id).sort());
  });
});
