import { registerModule, type ModuleManifest } from "../../core/module";

// The official Discord web app in an isolated webview (no custom client, no
// user token). Navigation, media permissions and the unread moon are handled
// generically for web panels in src-tauri/src/panels/webguard.rs.
export const discordModule: ModuleManifest = {
  id: "hub.discord",
  name: "Discord",
  description: "The Discord web app: voice, video, Go Live. Login persists.",
  panel: "web",
  web: {
    url: "https://discord.com/app",
    profile: "discord",
    hosts: ["discord.com", "*.discord.com", "discord.gg", "*.discordapp.com", "*.discordapp.net"],
    size: { w: 1100, h: 720 },
    min: { w: 480, h: 360 },
  },
  skills: [],
  accent: "#7c8cff",
  ring: "media",
  icon: "discord",
};

registerModule(discordModule);
