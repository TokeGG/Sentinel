// Pure: raw scan results (Rust game_manifests + steam_app_manifests) -> apps + per-launcher status lines.
import { parseEpicItem, type EpicApp } from "./epic.ts";
import { gogGames, ubisoftGames, uninstallGames, type OtherApp } from "./reg.ts";
import { parseAcf, type SteamApp } from "./vdf.ts";

export interface Manifests {
  steam_root: string | null; steam_tried: string[]; steam_libraries: string | null;
  epic_dir: string; epic_dir_found: boolean; epic_items: string[];
  gog_reg: string; ubisoft_reg: string; uninstall_reg: string; errors: string[];
}
export interface SteamLib { library: string; found: boolean; manifests: string[] }
export interface LauncherStatus { id: string; label: string; found: boolean; count: number; detail: string }
export interface ScanResult { steam: SteamApp[]; epic: EpicApp[]; others: OtherApp[]; status: LauncherStatus[]; errors: string[] }

const plural = (n: number) => `${n} game${n === 1 ? "" : "s"}`;

export function buildScan(m: Manifests, libs: SteamLib[]): ScanResult {
  const steam = libs.flatMap((l) => l.manifests.map(parseAcf)).filter((x): x is SteamApp => !!x);
  const epic = m.epic_items.map(parseEpicItem).filter((x): x is EpicApp => !!x);
  const groups = { gog: gogGames(m.gog_reg), ubisoft: ubisoftGames(m.ubisoft_reg) };
  const uninst = uninstallGames(m.uninstall_reg);
  const others = [...groups.gog, ...groups.ubisoft, ...uninst];
  const missing = libs.filter((l) => !l.found).map((l) => l.library);
  const status: LauncherStatus[] = [
    m.steam_root
      ? { id: "steam", label: "Steam", found: true, count: steam.length,
          detail: `found at ${m.steam_root}, ${libs.length} librar${libs.length === 1 ? "y" : "ies"}, ${plural(steam.length)}`
            + (m.steam_libraries ? "" : " (libraryfolders.vdf not found)")
            + (missing.length ? `; missing: ${missing.join(", ")}` : "") }
      : { id: "steam", label: "Steam", found: false, count: 0, detail: m.steam_tried.length ? `not found (looked in ${m.steam_tried.join(", ")})` : "not found" },
    m.epic_dir_found
      ? { id: "epic", label: "Epic", found: true, count: epic.length, detail: `${plural(epic.length)} in ${m.epic_dir}` }
      : { id: "epic", label: "Epic", found: false, count: 0, detail: m.epic_dir ? `not found (${m.epic_dir})` : "not found" },
  ];
  const other = (id: OtherApp["store"], label: string, list: OtherApp[]) =>
    status.push({ id, label, found: list.length > 0, count: list.length, detail: list.length ? plural(list.length) : "none found" });
  other("gog", "GOG Galaxy", groups.gog);
  other("ubisoft", "Ubisoft Connect", groups.ubisoft);
  other("battlenet", "Battle.net", uninst.filter((a) => a.store === "battlenet"));
  other("ea", "EA app", uninst.filter((a) => a.store === "ea"));
  return { steam, epic, others, status, errors: m.errors };
}
