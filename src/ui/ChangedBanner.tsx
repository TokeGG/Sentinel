// Generic panel banner: "N new since you last looked". Uses only the module's badge() count.
// Off with Settings > General > "What changed" banner (app_settings `changed_banner` = "0").
import { useEffect, useState } from "react";
import type { ModuleManifest } from "../core/module";
import { getSetting, setSetting } from "./appSetting";
import { changedText, parseSeen } from "./changedLogic";

export function ChangedBanner({ m }: { m: ModuleManifest }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!m.badge) return;
    (async () => {
      if ((await getSetting("changed_banner")) === "0") return;
      const count = await m.badge!();
      const key = `last_seen:${m.id}`;
      setText(changedText(parseSeen(await getSetting(key)), count, Date.now()));
      await setSetting(key, JSON.stringify({ at: Date.now(), count }));
    })().catch(() => {});
  }, [m]);
  if (!text) return null;
  return <div className="ui-changed" role="status">{text}<button type="button" className="ui-btn" aria-label="Dismiss" onClick={() => setText(null)}>x</button></div>;
}
