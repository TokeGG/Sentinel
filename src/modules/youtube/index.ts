import { registerModule, type ModuleManifest } from "../../core/module";
import { ytSections } from "./panelLogic";
import { addLater, clearHidden, clearHistory, clearSignal, importHistory, markWatched, removeLater, setSignal } from "./libraryStore";
import { addChannel, loadRows, refreshFeeds, removeChannel } from "./store";
import { importSubscriptions } from "./subsStore";
import { uploadBadge } from "./extrasStore";
import { checkLive, refreshAll } from "./liveStore";

// No Google account or API key: channels are added by URL and read from their
// public Atom feeds; "watched" is recorded locally when you play a video here.
export const youtubeModule: ModuleManifest = {
  id: "hub.youtube",
  name: "YouTube",
  accent: "#ff6b6b",
  ring: "media",
  icon: "youtube",
  description: "Channels you add by URL, their latest videos (public feeds), in-app playback, a watch-later queue, playlists, channel groups, continue watching, live/upcoming streams, a pop-out player and local recommendations (thumbs and not-interested feed them).",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: ytSections },
  skills: [
    { name: "add_channel", run: addChannel },
    { name: "remove_channel", run: removeChannel },
    { name: "refresh_feeds", run: refreshFeeds },
    { name: "check_live", run: checkLive },
    { name: "refresh_all", run: refreshAll },
    { name: "mark_watched", run: markWatched },
    { name: "clear_history", run: clearHistory },
    { name: "import_history", run: importHistory },
    { name: "add_later", run: addLater },
    { name: "remove_later", run: removeLater },
    { name: "set_signal", run: setSignal },
    { name: "clear_signal", run: clearSignal },
    { name: "clear_hidden", run: clearHidden },
    { name: "import_subscriptions", run: importSubscriptions },
  ],
  load: loadRows,
  quickAdd: { skill: "add_channel", argName: "url", placeholder: "Channel or video URL, @handle, or UC… id" },
  actions: [{ label: "Refresh", skill: "refresh_feeds" }],
  schedule: { skill: "refresh_all", intervalMinutes: 60 },
  badge: uploadBadge,
};

registerModule(youtubeModule);
