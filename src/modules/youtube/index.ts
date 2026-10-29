import { registerModule, type ModuleManifest } from "../../core/module";
import { ytSections } from "./panelLogic";
import { addChannel, clearHistory, importHistory, loadRows, markWatched, refreshFeeds, removeChannel } from "./store";

// No Google account or API key: channels are added by URL and read from their
// public Atom feeds; "watched" is recorded locally when you play a video here.
export const youtubeModule: ModuleManifest = {
  id: "hub.youtube",
  name: "YouTube",
  accent: "#ff6b6b",
  ring: "media",
  icon: "youtube",
  description: "Channels you add by URL, their latest videos (public feeds), in-app playback and local recommendations.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: ytSections },
  skills: [
    { name: "add_channel", run: addChannel },
    { name: "remove_channel", run: removeChannel },
    { name: "refresh_feeds", run: refreshFeeds },
    { name: "mark_watched", run: markWatched },
    { name: "clear_history", run: clearHistory },
    { name: "import_history", run: importHistory },
  ],
  load: loadRows,
  quickAdd: { skill: "add_channel", argName: "url", placeholder: "Channel or video URL, @handle, or UC… id" },
  actions: [{ label: "Refresh", skill: "refresh_feeds" }],
  schedule: { skill: "refresh_feeds", intervalMinutes: 60 },
};

registerModule(youtubeModule);
