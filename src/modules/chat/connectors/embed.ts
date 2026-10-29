import type { Connector } from "../types";
import { parseEmbed } from "./rooms";

// "Any site": a chat popout/embed page shown in an iframe. No connect(): the
// site draws its own chat, emotes and send box. iCanHazChat uses this.
export const embed: Connector = {
  id: "embed",
  label: "Embed (any site)",
  color: "#8892b0",
  placeholder: "chat popout URL (https://…)",
  parseRoom: parseEmbed,
};
