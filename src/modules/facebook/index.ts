import { registerModule, type ModuleManifest } from "../../core/module";
import { webSite } from "../../core/webSite";

export const facebookModule: ModuleManifest = {
  ...webSite("facebook", "Facebook", "https://www.facebook.com", ["facebook.com", "*.facebook.com", "fb.com", "*.fbcdn.net"]),
  accent: "#4c8dff",
  ring: "media",
  icon: "facebook",
};

registerModule(facebookModule);
