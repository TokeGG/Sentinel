import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { libraryPaths, parseAcf, parseVdf } from "./vdf.ts";
import { epicLaunchUri, parseEpicItem, steamLaunchUri, steamNewsUrl } from "./epic.ts";
import { filterGames, gamesSections, mergeLibrary, newsTargets, playedText, recentGames } from "./panelLogic.ts";

const LIB = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"apps" { "440" "123" }
	}
	"1" { "path" "D:\\\\SteamLibrary" }
	"contentstatsid" "x"
}`;
const OLD = `"LibraryFolders" { "TimeNextStatsReport" "1" "1" "E:\\\\Games" }`;
const ACF = `"AppState"
{
	"appid"		"440"
	"name"		"Team \\"Fortress\\" 2" // comment
	"installdir"		"Team Fortress 2"
	"LastPlayed"		"1700000000"
	"SizeOnDisk"		"2048"
}`;
const EPIC = JSON.stringify({ AppName: "Fortnite", DisplayName: "Fortnite", CatalogNamespace: "fn", CatalogItemId: "4fe7", InstallLocation: "C:\\Epic\\Fortnite" });

describe("vdf", () => {
  it("parses nested keys, escapes and comments", () => {
    assert.deepEqual(parseVdf(`"a" { "b" "c\\"d" // x\n "e" { } }`), { a: { b: 'c"d', e: {} } });
    assert.deepEqual(parseVdf(`"a" {`), { a: {} });
  });
  it("library paths in new and old format", () => {
    assert.deepEqual(libraryPaths(LIB), ["C:\\Program Files (x86)\\Steam", "D:\\SteamLibrary"]);
    assert.deepEqual(libraryPaths(OLD), ["E:\\Games"]);
    assert.deepEqual(libraryPaths("junk"), []);
  });
  it("acf app", () => {
    assert.deepEqual(parseAcf(ACF), { appid: "440", name: 'Team "Fortress" 2', installdir: "Team Fortress 2", lastPlayed: 1700000000, sizeOnDisk: 2048 });
    assert.equal(parseAcf(`"AppState" { "appid" "x" "name" "n" }`), null);
  });
});

describe("epic", () => {
  it("parses items, skips DLC/incomplete/bad", () => {
    assert.equal(parseEpicItem(EPIC)?.name, "Fortnite");
    assert.equal(parseEpicItem("{"), null);
    assert.equal(parseEpicItem(JSON.stringify({ ...JSON.parse(EPIC), MainGameAppName: "Other" })), null);
    assert.equal(parseEpicItem(JSON.stringify({ ...JSON.parse(EPIC), bIsIncompleteInstall: true })), null);
  });
  it("launch uris", () => {
    assert.equal(steamLaunchUri("440"), "steam://rungameid/440");
    assert.equal(steamLaunchUri("4;x"), null);
    assert.equal(epicLaunchUri({ ns: "fn", itemId: "4fe7", appName: "Fortnite" }), "com.epicgames.launcher://apps/fn%3A4fe7%3AFortnite?action=launch&silent=true");
    assert.equal(steamNewsUrl("440"), "https://store.steampowered.com/feeds/news/app/440/");
  });
});

describe("games panelLogic", () => {
  const steam = [parseAcf(ACF)!, { appid: "10", name: "Alpha", installdir: "", lastPlayed: 0, sizeOnDisk: 0 }];
  const g = mergeLibrary(steam, [parseEpicItem(EPIC)!], [{ game_key: "steam:10", favorite: 1, last_played: null, plays: 0 }, { game_key: "epic:Fortnite", favorite: 0, last_played: "2024-01-01T00:00:00Z", plays: 1 }]);
  it("merges, favourites first then name", () => {
    assert.deepEqual(g.map((x) => x.key), ["steam:10", "epic:Fortnite", "steam:440"]);
    assert.equal(g[1].lastPlayed, 1704067200);
  });
  it("recent, filter, news targets", () => {
    assert.deepEqual(recentGames(g).map((x) => x.key), ["epic:Fortnite", "steam:440"]);
    assert.deepEqual(filterGames(g, "team", false).map((x) => x.appid), ["440"]);
    assert.deepEqual(filterGames(g, "", true).map((x) => x.appid), ["10"]);
    assert.deepEqual(newsTargets(g), ["10", "440"]);
  });
  it("playedText", () => {
    assert.equal(playedText(0), "never");
    assert.equal(playedText(1000, 1000_000), "today");
    assert.equal(playedText(0.5, 86400_000 * 3), "2 days ago");
  });
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, gamesSections.map((s) => s.id).sort());
  });
});
