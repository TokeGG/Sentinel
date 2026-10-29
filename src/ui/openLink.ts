// Every link the app opens goes through openLink(): http(s) links open in the in-app
// browser panel (hub.browser) unless app_settings `links_open_in` = system.
import { emit } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getSetting } from "./appSetting";
import { BROWSER_ID, BROWSER_OPEN, BROWSER_PENDING, queueLink, safeLink } from "./safeLink";

/** Open a link: in-app browser (default) or the system browser. Non-http(s) links are ignored. */
export async function openLink(l: unknown, where?: "app" | "system"): Promise<void> {
  const url = safeLink(l);
  if (!url) return;
  const mode = where ?? ((await getSetting("links_open_in").catch(() => null)) === "system" ? "system" : "app");
  if (mode === "system") return openUrl(url);
  try {
    localStorage.setItem(BROWSER_PENDING, queueLink(localStorage.getItem(BROWSER_PENDING), url));
  } catch {
    return openUrl(url); // no shared storage: fall back rather than lose the link
  }
  await emit("shell-cmd", { type: "open", id: BROWSER_ID });
  await emit(BROWSER_OPEN, {});
}
