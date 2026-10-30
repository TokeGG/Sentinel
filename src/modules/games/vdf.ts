// Pure: Valve KeyValues (VDF/ACF) text -> nested objects; library paths and app manifests.
export type Vdf = { [k: string]: string | Vdf };

function tokens(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "{" || c === "}") { out.push(c); i++; continue; }
    if (c === '"') {
      let s = "";
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && i + 1 < text.length) { const n = text[++i]; s += n === "n" ? "\n" : n === "t" ? "\t" : n; }
        else s += text[i];
        i++;
      }
      out.push("\u0000" + s); // marks a string token
      i++;
      continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    let s = "";
    while (i < text.length && !/[\s{}"]/.test(text[i])) s += text[i++];
    out.push("\u0000" + s);
  }
  return out;
}

/** Parses VDF; malformed input yields whatever parsed so far (never throws). */
export function parseVdf(text: string): Vdf {
  const t = tokens(text);
  let i = 0;
  const obj = (): Vdf => {
    const o: Vdf = {};
    while (i < t.length && t[i] !== "}") {
      const k = t[i++];
      if (k === "{") continue;
      const key = k.slice(1);
      if (t[i] === "{") { i++; o[key] = obj(); i++; }
      else if (i < t.length && t[i] !== "}") o[key] = t[i++].slice(1);
    }
    return o;
  };
  return obj();
}

const child = (v: unknown, k: string): unknown => (v && typeof v === "object" ? (v as Vdf)[k] ?? (v as Vdf)[k.toLowerCase()] : undefined);

/** Library folder paths from libraryfolders.vdf (new "path" entries and old plain-string form). */
export function libraryPaths(text: string): string[] {
  const root = child(parseVdf(text), "libraryfolders") ?? child(parseVdf(text), "LibraryFolders");
  if (!root || typeof root !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(root)) {
    if (!/^\d+$/.test(k)) continue;
    const p = typeof v === "string" ? v : typeof v.path === "string" ? v.path : "";
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

export interface SteamApp { appid: string; name: string; installdir: string; lastPlayed: number; sizeOnDisk: number }

/** One appmanifest_*.acf -> app, or null when it lacks an appid/name. */
export function parseAcf(text: string): SteamApp | null {
  const s = child(parseVdf(text), "AppState");
  if (!s || typeof s !== "object") return null;
  const g = (k: string) => { const v = child(s, k); return typeof v === "string" ? v : ""; };
  const appid = g("appid");
  const name = g("name");
  if (!/^\d+$/.test(appid) || !name) return null;
  return { appid, name, installdir: g("installdir"), lastPlayed: Number(g("LastPlayed")) || 0, sizeOnDisk: Number(g("SizeOnDisk")) || 0 };
}

const norm = (p: string) => p.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();

/** Every library to read: the Steam root itself (old-format vdf omits it, or the vdf is missing) + vdf paths. */
export function steamLibraries(root: string | null, vdf: string | null): string[] {
  const out: string[] = [];
  for (const p of [...(root ? [root] : []), ...(vdf ? libraryPaths(vdf) : [])])
    if (!out.some((x) => norm(x) === norm(p))) out.push(p);
  return out;
}
