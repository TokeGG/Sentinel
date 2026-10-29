import type { Connector } from "../types";
import { parseYoutube, youtubeChatUrls } from "./rooms";

// YouTube live chat: no socket (no public chat API without a key); the live_chat
// page is framed like any embed. YouTube may refuse framing: "Open as its own panel".
export const youtube: Connector = {
  id: "youtube",
  label: "YouTube live",
  color: "#ff4e45",
  placeholder: "watch / youtu.be / live URL, or video id",
  parseRoom: parseYoutube,
  urls: (room, host) => youtubeChatUrls(room.target, host),
};
