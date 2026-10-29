// 28px chrome strip, a child webview stacked above every panel's content
// (Task 9b). Stateless: every rect comes from Rust (get/focus_panel).
import { useEffect, useState } from "react";
import { emitTo } from "@tauri-apps/api/event";
import { registry } from "../core/module";
import { closePanel, commit, getPanel, SETTINGS_ID, toggleFullWindow } from "./panelApi";
import { useDragPanel } from "./useDragPanel";
import { PANEL_CUSTOMIZE, panelLabel } from "./panelEvents";

const PREFIX = "#/chrome/";
/** Never throws: malformed %-escapes yield "" (renders "Module not found"). */
export function chromeIdFromHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    return decodeURIComponent(hash.slice(PREFIX.length));
  } catch {
    return "";
  }
}

export function ChromeRoute({ id }: { id: string }) {
  const m = registry.find((x) => x.id === id);
  const [full, setFull] = useState(false);
  const { err, fail, handlers } = useDragPanel(id, "move", m?.web?.min);

  // A raise (focus_panel on a non-top panel) re-creates this webview before
  // the reply arrives, so the fresh chrome persists the authoritative z here.
  useEffect(() => {
    getPanel(id).then(commit).catch(() => {});
  }, [id]);

  return (
    <div className="panel-chrome" {...handlers}>
      <span className="panel-chrome-title" style={err ? { color: "#ff7b7b" } : undefined} title={err ?? undefined}>{err ?? (m ? m.name : id === SETTINGS_ID ? "Settings" : id ? id : "Module not found")}</span>
      {m && m.panel !== "web" && (
        <button className="panel-chrome-gear" title="Customize" aria-label="Customize panel"
          onClick={() => emitTo(panelLabel(id), PANEL_CUSTOMIZE, { id }).catch(fail("customize"))}>⚙</button>
      )}
      {m?.panel === "web" && (
        <button className="panel-chrome-gear" title={full ? "Restore size" : "Full window"} aria-label="Toggle full window"
          onClick={() => toggleFullWindow(id).then(setFull, fail("full window"))}>{full ? "⤡" : "⤢"}</button>
      )}
      <button className="panel-chrome-close" title="Close" aria-label="Close panel"
        onClick={() => closePanel(id).catch(fail("close"))}>×</button>
    </div>
  );
}
