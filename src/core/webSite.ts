import type { ModuleManifest } from "./module";

// Sites with no usable read/like API for personal accounts open the real site in an
// isolated webview with its own persistent login (like Discord). Like and comment there.
export const webSite = (id: string, name: string, url: string, hosts: string[]) => ({
  id: `hub.${id}`,
  name,
  description: `${name} in its own window. Log in once; login persists.`,
  panel: "web" as const,
  web: { url, profile: id, hosts, size: { w: 520, h: 760 }, min: { w: 360, h: 420 } },
  skills: [],
}) satisfies Partial<ModuleManifest>;
