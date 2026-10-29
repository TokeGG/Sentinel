import { registerModule, type ModuleManifest } from "../../core/module";
import { webSite } from "../../core/webSite";

export const instagramModule: ModuleManifest = {
  ...webSite("instagram", "Instagram", "https://www.instagram.com", ["instagram.com", "*.instagram.com", "*.cdninstagram.com", "*.fbcdn.net"]),
  accent: "#ffa8b8",
  ring: "media",
  icon: "instagram",
};

registerModule(instagramModule);
