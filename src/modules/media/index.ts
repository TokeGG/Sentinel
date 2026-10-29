import { emit } from "@tauri-apps/api/event";
import { registerModule, registry, type ModuleManifest } from "../../core/module";
import { openPanel } from "../../shell/panelApi";
import { findSkill } from "../../ui/moduleRun";
import { imageData, listImages, nowPlaying, pickFolder, sportsScores, twitchLive } from "./api";
import { mediaSections } from "./panelLogic";
import { addShow, listShows, refreshShows, removeShow, setNext, showToCalendar } from "./shows";

/** Adds a Twitch channel to the Chat panel (multiview) and opens it. */
async function watchInChat(a?: Record<string, unknown>) {
  const login = String(a?.login ?? "");
  if (!/^\w{1,25}$/.test(login)) throw new Error("bad channel name");
  const chat = registry.find((m) => m.id === "hub.chat");
  if (!chat) throw new Error("The Chat module is not available");
  const out = (await findSkill(chat, "add_room").run({ input: login, site: "twitch", label: login })) as { id?: string };
  await emit("chat-rooms-changed", { id: out?.id });
  await openPanel(chat);
  return { ok: true };
}

// Now playing (stub until a WinRT reader exists), Twitch live follows, show tracker, image folder, sports.
// Network calls happen only from a button or the opt-in schedule (show dates).
export const mediaModule: ModuleManifest = {
  id: "hub.media",
  name: "Media",
  accent: "#008888",
  ring: "media",
  category: "media",
  icon: "media",
  description: "Now playing, Twitch live follows, show tracker, image folder and sports scores.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: {
    sections: mediaSections,
    options: [{ key: "league", label: "Sports league", type: "select", choices: ["nfl", "nba", "mlb", "nhl", "epl", "mls"], default: "nfl" }],
  },
  skills: [
    { name: "now_playing", run: nowPlaying },
    { name: "twitch_live", run: twitchLive },
    { name: "watch_in_chat", run: watchInChat },
    { name: "add_show", run: addShow },
    { name: "refresh_shows", run: refreshShows },
    { name: "set_next", run: setNext },
    { name: "remove_show", run: removeShow },
    { name: "show_to_calendar", run: showToCalendar },
    { name: "pick_folder", run: pickFolder },
    { name: "list_images", run: listImages },
    { name: "image_data", run: imageData },
    { name: "sports_scores", run: sportsScores },
  ],
  load: async () => (await listShows()).map((s) => ({ ...s, id: `show-${s.id}`, title: s.name })),
  schedule: { skill: "refresh_shows", intervalMinutes: 720 },
};

registerModule(mediaModule);
