// app_settings I/O for smart folders + panel groups, the palette provider that
// lists them, and runSmartTerminal() for the Terminal home to call.
import { getSetting, setSetting } from "../../ui/appSetting";
import { registerSearchProvider, type Hit } from "../../core/search/registry";
import { resolveNamed, sanitizeFolders, sanitizeGroups, type Groups, type SmartFolders } from "./collections";
import { sendCmd } from "./shellCmd";

const json = (v: string | null): unknown => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
export const getFolders = async (): Promise<SmartFolders> => sanitizeFolders(json(await getSetting("smart_folders")));
export const setFolders = (f: SmartFolders) => setSetting("smart_folders", JSON.stringify(sanitizeFolders(f)));
export const getGroups = async (): Promise<Groups> => sanitizeGroups(json(await getSetting("panel_groups")));
export const setGroups = (g: Groups) => setSetting("panel_groups", JSON.stringify(sanitizeGroups(g)));

/** Palette reads (and clears) this on mount to start with a saved query. */
export const PALETTE_QUERY = "palette_query";
export function takePaletteQuery(): string {
  try { const q = localStorage.getItem(PALETTE_QUERY) ?? ""; localStorage.removeItem(PALETTE_QUERY); return q; } catch { return ""; }
}

export function registerCollections() {
  registerSearchProvider({
    id: "collections", label: "Smart folders & groups",
    search: async (): Promise<Hit[]> => {
      const [f, g] = await Promise.all([getFolders(), getGroups()]);
      return [
        ...Object.keys(f).map((n): Hit => ({ key: `sf:${n}`, title: `Smart folder: ${n}`, subtitle: f[n], kind: "command", run: () => sendCmd({ type: "smartFolder", name: n }) })),
        ...Object.keys(g).map((n): Hit => ({ key: `grp:${n}`, title: `Open group: ${n}`, subtitle: g[n].join(", "), kind: "command", run: () => sendCmd({ type: "group", name: n }) })),
      ];
    },
  });
}

/** For the Terminal home: "folder <name>" or "group <name>"; returns false if no match. */
export async function runSmartTerminal(text: string): Promise<boolean> {
  const r = resolveNamed(text, await getFolders(), await getGroups());
  if (!r) return false;
  await sendCmd(r.kind === "folder" ? { type: "smartFolder", name: r.name } : { type: "group", name: r.name });
  return true;
}
