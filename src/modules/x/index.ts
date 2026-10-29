import { registerModule, type ModuleManifest } from "../../core/module";
import { webSite } from "../../core/webSite";

export const xModule: ModuleManifest = {
  ...webSite("x", "X", "https://x.com/home", ["x.com", "*.x.com", "twitter.com", "*.twitter.com", "*.twimg.com"]),
  accent: "#9aa5b1",
  ring: "media",
  icon: "x",
};

registerModule(xModule);
