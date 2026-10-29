import { registerModule, type ModuleManifest } from "../../core/module";
import { webSite } from "../../core/webSite";

export const xModule: ModuleManifest = {
  ...webSite("x", "X", "https://x.com/home", ["x.com", "*.x.com", "twitter.com", "*.twitter.com", "*.twimg.com"]),
  accent: "#92a5f7",
  ring: "media",
  icon: "x",
};

registerModule(xModule);
