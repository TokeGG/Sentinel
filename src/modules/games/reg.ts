// Pure: Windows `reg query /s` output -> keys/values, and installed games for GOG, Ubisoft,
// Battle.net and EA (registry install keys). Launch URIs for these are not allow-listed, so they open nothing.
export interface RegKey { path: string; values: Record<string, string> }
export interface OtherApp { store: "gog" | "ubisoft" | "battlenet" | "ea"; id: string; name: string; path: string }

export function parseRegQuery(text: string): RegKey[] {
  const out: RegKey[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (/^HKEY_/i.test(raw)) { out.push({ path: raw.trim(), values: {} }); continue; }
    const m = /^\s+(.+?)\s{4}(REG_\w+)\s{4}(.*)$/.exec(raw) ?? /^\s+(.+?)\s{4}(REG_\w+)\s*$/.exec(raw);
    if (m && out.length) out[out.length - 1].values[m[1].trim().toLowerCase()] = (m[3] ?? "").trim();
  }
  return out;
}

const last = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";

export function gogGames(text: string): OtherApp[] {
  return parseRegQuery(text).flatMap((k) => {
    const v = k.values;
    const id = v.gameid || v.productid || "";
    const name = v.gamename || v.startmenu || "";
    return /^\d+$/.test(id) && name ? [{ store: "gog" as const, id, name, path: v.path || "" }] : [];
  });
}

export function ubisoftGames(text: string): OtherApp[] {
  return parseRegQuery(text).flatMap((k) => {
    const id = last(k.path);
    const dir = k.values.installdir || "";
    return /^\d+$/.test(id) && dir ? [{ store: "ubisoft" as const, id, name: last(dir) || id, path: dir }] : [];
  });
}

const LAUNCHERS = /^(battle\.net|ea app|ea|origin|ubisoft connect|uplay|gog galaxy)$/i;

/** Battle.net / EA games from Uninstall keys (Publisher match); the launchers themselves are skipped. */
export function uninstallGames(text: string): OtherApp[] {
  return parseRegQuery(text).flatMap((k) => {
    const v = k.values;
    const name = v.displayname || "";
    const pub = v.publisher || "";
    const store = /blizzard/i.test(pub) ? "battlenet" : /electronic arts/i.test(pub) ? "ea" : null;
    if (!store || !name || LAUNCHERS.test(name.trim()) || v.systemcomponent === "0x1") return [];
    return [{ store, id: last(k.path), name, path: v.installlocation || "" }];
  });
}
