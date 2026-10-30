import { useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openMaster, openSettings, reclampPanels } from "./panelApi";
import { getShown, subscribeShown } from "./notifStore";
import { totalOf } from "./notifLogic";
import { useTitleStyle } from "./desk/useTitleStyle";
import { DndButton, PinnedCounts } from "./TitleExtras";

// The one title bar (main window is frameless, like Discord): app name left,
// the HUD controls (children) next to it, drag region in between, window
// buttons right. Outside Tauri (plain browser) the buttons are inert.
const win = () => {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
};

const Glyph = ({ d }: { d: string }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d={d} /></svg>
);

// Unread total (read/snooze/DND/quiet hours applied); click opens the Master Hub.
function UnreadPill({ onError }: { onError: (e: string) => void }) {
  const [n, setN] = useState(() => totalOf(getShown()));
  useEffect(() => subscribeShown(() => setN(totalOf(getShown()))), []);
  if (n === 0) return null;
  return (
    <button className="titlebar-pill" title="Open Master Hub" aria-label={`${n} unread, open Master Hub`}
      onClick={() => openMaster().catch((e) => onError(String(e)))}>{n > 99 ? "99+" : n}</button>
  );
}

export function TitleBar({ children, onError }: { children?: ReactNode; onError: (e: string) => void }) {
  const [max, setMax] = useState(false);
  const style = useTitleStyle(); // Settings > Panels: compact / auto-hide
  const timer = useRef(0);
  useEffect(() => {
    const w = win();
    if (!w) return;
    const sync = () => w.isMaximized().then(setMax, () => {});
    sync();
    // Maximise / restore / manual resize: keep every panel inside the new area.
    const un = w.onResized(() => {
      sync();
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => reclampPanels().catch((e) => onError(`Panels: ${String(e)}`)), 150);
    });
    return () => {
      window.clearTimeout(timer.current);
      un.then((f) => f()).catch(() => {});
    };
  }, []);
  const run = (f: (w: NonNullable<ReturnType<typeof win>>) => Promise<unknown>) => () => {
    const w = win();
    if (w) f(w).catch((e) => onError(String(e)));
  };
  return (
    <header className={`titlebar tb-${style}`}>
      <div className="titlebar-brand" data-tauri-drag-region onDoubleClick={run((w) => w.toggleMaximize())}>
        <span className="titlebar-logo" data-tauri-drag-region />
        <span data-tauri-drag-region>Sentinel</span>
      </div>
      <div className="titlebar-tools">{children}</div>
      <div className="titlebar-drag" data-tauri-drag-region onDoubleClick={run((w) => w.toggleMaximize())} />
      <PinnedCounts onError={onError} />
      <DndButton onError={onError} />
      <UnreadPill onError={onError} />
      <button className="titlebar-gear" title="Settings" aria-label="Settings" onClick={() => openSettings().catch((e) => onError(String(e)))}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" /><path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1" />
        </svg>
      </button>
      <div className="titlebar-btns">
        <button title="Minimize" aria-label="Minimize" onClick={run((w) => w.minimize())}><Glyph d="M1 5.5h8" /></button>
        <button title={max ? "Restore" : "Maximize"} aria-label={max ? "Restore" : "Maximize"} onClick={run((w) => w.toggleMaximize())}>
          <Glyph d={max ? "M2.5 3.5h5v5h-5zM3.5 3.5v-2h5v5h-1" : "M1.5 1.5h7v7h-7z"} />
        </button>
        <button className="close" title="Close" aria-label="Close" onClick={run((w) => w.close())}><Glyph d="M1.5 1.5l7 7M8.5 1.5l-7 7" /></button>
      </div>
    </header>
  );
}
