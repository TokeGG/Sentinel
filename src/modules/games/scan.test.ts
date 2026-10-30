import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gogGames, parseRegQuery, ubisoftGames, uninstallGames } from "./reg.ts";
import { buildScan, type Manifests } from "./scan.ts";
import { libraryPaths, steamLibraries } from "./vdf.ts";
import { mergeLibrary } from "./panelLogic.ts";

const GOG = `
HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1207658924
    gameID    REG_SZ    1207658924
    gameName    REG_SZ    The Witcher 3: Wild Hunt
    path    REG_SZ    D:\\GOG Games\\The Witcher 3

HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\bad
    gameName    REG_SZ    Nope
`.replace(/\n/g, "\r\n");
const UBI = `HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs
HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs\\635
    InstallDir    REG_SZ    C:/Program Files (x86)/Ubisoft/Games/Far Cry 5/
`;
const UNINST = `HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Overwatch
    DisplayName    REG_SZ    Overwatch
    Publisher    REG_SZ    Blizzard Entertainment
    InstallLocation    REG_SZ    C:\\Games\\Overwatch
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Battle.net
    DisplayName    REG_SZ    Battle.net
    Publisher    REG_SZ    Blizzard Entertainment
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{1}
    DisplayName    REG_SZ    Apex Legends
    Publisher    REG_SZ    Electronic Arts
    Empty    REG_SZ
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\7zip
    DisplayName    REG_SZ    7-Zip
    Publisher    REG_SZ    Igor Pavlov
`;
const ACF = (id: string, n: string) => `"AppState" { "appid" "${id}" "name" "${n}" "installdir" "x" }`;

describe("reg query", () => {
  it("parses keys and values incl. empty and CRLF", () => {
    const k = parseRegQuery(GOG);
    assert.equal(k.length, 2);
    assert.equal(k[0].values.path, "D:\\GOG Games\\The Witcher 3");
    assert.equal(parseRegQuery(UNINST)[2].values.empty, "");
    assert.deepEqual(parseRegQuery("ERROR: The system was unable to find the specified registry key or value."), []);
  });
  it("extracts GOG, Ubisoft, Battle.net and EA games", () => {
    assert.deepEqual(gogGames(GOG), [{ store: "gog", id: "1207658924", name: "The Witcher 3: Wild Hunt", path: "D:\\GOG Games\\The Witcher 3" }]);
    assert.deepEqual(ubisoftGames(UBI).map((a) => [a.id, a.name]), [["635", "Far Cry 5"]]);
    assert.deepEqual(uninstallGames(UNINST).map((a) => [a.store, a.name]), [["battlenet", "Overwatch"], ["ea", "Apex Legends"]]);
  });
});

describe("steam libraries", () => {
  it("always includes the Steam root (old format omits it) and dedupes slash/case variants", () => {
    const old = `"LibraryFolders" { "TimeNextStatsReport" "1" "1" "E:\\\\Games" }`;
    assert.deepEqual(libraryPaths(old), ["E:\\Games"]);
    assert.deepEqual(steamLibraries("C:\\Program Files (x86)\\Steam", old), ["C:\\Program Files (x86)\\Steam", "E:\\Games"]);
    const neu = `"libraryfolders" { "0" { "path" "c:\\\\program files (x86)\\\\steam" } "1" { "path" "D:\\\\SteamLibrary" } }`;
    assert.deepEqual(steamLibraries("C:/Program Files (x86)/Steam/", neu), ["C:/Program Files (x86)/Steam/", "D:\\SteamLibrary"]);
    assert.deepEqual(steamLibraries("C:\\Steam", null), ["C:\\Steam"]);
    assert.deepEqual(steamLibraries(null, null), []);
  });
});

const M = (o: Partial<Manifests>): Manifests => ({ steam_root: null, steam_tried: [], steam_libraries: null, epic_dir: "", epic_dir_found: false,
  epic_items: [], gog_reg: "", ubisoft_reg: "", uninstall_reg: "", errors: [], ...o });

describe("buildScan", () => {
  it("reads apps from every library and reports per-launcher status", () => {
    const r = buildScan(M({ steam_root: "C:\\Steam", steam_libraries: "x", epic_dir: "C:\\PD", epic_dir_found: true, gog_reg: GOG, uninstall_reg: UNINST }),
      [{ library: "C:\\Steam", found: true, manifests: [ACF("440", "TF2")] }, { library: "D:\\Lib", found: true, manifests: [ACF("570", "Dota 2"), "junk"] },
       { library: "F:\\Gone", found: false, manifests: [] }]);
    assert.deepEqual(r.steam.map((a) => a.appid), ["440", "570"]);
    assert.match(r.status[0].detail, /found at C:\\Steam, 3 libraries, 2 games; missing: F:\\Gone/);
    assert.equal(r.status[1].detail, "0 games in C:\\PD");
    assert.deepEqual(r.status.map((s) => [s.id, s.count]), [["steam", 2], ["epic", 0], ["gog", 1], ["ubisoft", 0], ["battlenet", 1], ["ea", 1]]);
    const g = mergeLibrary(r.steam, r.epic, [], r.others);
    assert.equal(g.find((x) => x.store === "gog")?.uri, "");
    assert.equal(g.length, 5);
  });
  it("explains a missing Steam/Epic and missing vdf", () => {
    const r = buildScan(M({ steam_tried: ["C:\\a", "C:\\b"], epic_dir: "C:\\PD\\M", errors: ["Game libraries are read on Windows only."] }), []);
    assert.equal(r.status[0].detail, "not found (looked in C:\\a, C:\\b)");
    assert.equal(r.status[1].detail, "not found (C:\\PD\\M)");
    assert.deepEqual(r.errors, ["Game libraries are read on Windows only."]);
    assert.match(buildScan(M({ steam_root: "C:\\S" }), [{ library: "C:\\S", found: true, manifests: [] }]).status[0].detail, /libraryfolders\.vdf not found/);
  });
});
