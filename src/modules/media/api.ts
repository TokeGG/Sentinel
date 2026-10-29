// Tauri/network I/O for Media. Every call here runs only from a button or the opt-in schedule.
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { open } from "@tauri-apps/plugin-dialog";
import { getAccessToken } from "../../core/connect";
import { clientIdFor } from "../../core/connect/clientStore";
import { getSetting, setSetting } from "../../ui/appSetting";
import { followedUrl, LEAGUES, parseFollowed, parseScoreboard, scoreboardUrl, type Score } from "./parsers";
import { joinPath } from "./panelLogic";

export interface NowPlaying { available: boolean; reason: string; title: string; artist: string; app: string; playing: boolean }
export const nowPlaying = () => invoke<NowPlaying>("now_playing");

export async function twitchLive() {
  const token = await getAccessToken("twitch");
  const v = (await (await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } })).json()) as { user_id?: string };
  if (!v.user_id) throw new Error("Twitch token is invalid; press Connect again in Settings > Accounts.");
  const res = await fetch(followedUrl(v.user_id), { headers: { Authorization: `Bearer ${token}`, "Client-Id": await clientIdFor("twitch") } });
  if (res.status === 401) throw new Error("Twitch needs the user:read:follows permission: press Connect again in Settings > Accounts.");
  if (!res.ok) throw new Error(`Twitch answered ${res.status}`);
  return parseFollowed(await res.json());
}

export async function sportsScores(args?: Record<string, unknown>): Promise<Score[]> {
  const leagues = (Array.isArray(args?.leagues) ? (args.leagues as string[]) : []).filter((l) => l in LEAGUES).slice(0, 6);
  const out: Score[] = [];
  for (const l of leagues) {
    const res = await fetch(scoreboardUrl(l)!);
    if (res.ok) out.push(...parseScoreboard(await res.json(), l));
  }
  return out;
}

const FOLDER = "media_folder";
export async function pickFolder() {
  const dir = await open({ directory: true, multiple: false });
  if (typeof dir === "string") await setSetting(FOLDER, dir);
  return { folder: typeof dir === "string" ? dir : null };
}

export async function listImages() {
  const folder = await getSetting(FOLDER);
  if (!folder) return { folder: null, files: [] };
  return { folder, files: await invoke<{ name: string; size: number; modified: number }[]>("list_dir_files", { path: folder }) };
}

export async function imageData(args?: Record<string, unknown>) {
  const folder = await getSetting(FOLDER);
  const name = String(args?.name ?? "");
  if (!folder || !name || /[\\/]/.test(name)) throw new Error("pick a folder first");
  return invoke<string>("read_image_data", { path: joinPath(folder, name) });
}
