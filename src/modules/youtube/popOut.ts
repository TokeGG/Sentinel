// Hands a queue to the pop-out player panel (hub.ytplayer): app_settings `yt_queue` for a
// fresh webview, emitTo for an open one; then opens it and pins it (kept on top).
import { emitTo } from "@tauri-apps/api/event";
import { focusPanel, openYtPlayer, YTPLAYER_ID } from "../../shell/panelApi";
import { panelLabel } from "../../shell/panelEvents";
import { getPins, setPins } from "../../shell/desk/store";
import { setSetting } from "../../ui/appSetting";
import { QUEUE_EVENT, QUEUE_KEY, type Queue } from "./queue";

export async function popOut(q: Queue): Promise<void> {
  await setSetting(QUEUE_KEY, JSON.stringify(q));
  await emitTo(panelLabel(YTPLAYER_ID), QUEUE_EVENT, q).catch(() => {});
  await openYtPlayer();
  const pins = await getPins().catch(() => [] as string[]);
  if (!pins.includes(YTPLAYER_ID)) await setPins([...pins, YTPLAYER_ID]).catch(() => {});
  await focusPanel(YTPLAYER_ID, true).catch(() => {});
}
