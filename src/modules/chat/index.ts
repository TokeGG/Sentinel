import { registerModule, type ModuleManifest } from "../../core/module";
import { chatOptions, chatSections } from "./panelLogic";
import { addRoom, loadRooms, moveRoom, pinRoom, removeRoom } from "./store";

// Multi-site chat (Chatterino-style). Sockets live in the panel webview and
// only while the panel is open; nothing runs in the background.
export const chatModule: ModuleManifest = {
  id: "hub.chat",
  name: "Chat",
  accent: "#c28efb",
  ring: "media",
  category: "social",
  icon: "chat",
  description: "Twitch, Kick and destiny.gg chat in tabs or columns, with 7TV/BTTV/FFZ emotes; YouTube live chat and any other site as an embed.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: chatSections, options: chatOptions },
  credentialFields: [{ key: "twitch_oauth", label: "Twitch OAuth token (chat:read + chat:edit)" }],
  skills: [
    { name: "add_room", run: addRoom },
    { name: "remove_room", run: removeRoom },
    { name: "move_room", run: moveRoom },
    { name: "pin_room", run: pinRoom },
  ],
  load: loadRooms,
};

registerModule(chatModule);
