import { useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { reclampPanels } from "./panelApi";

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

export function TitleBar({ children, onError }: { children?: ReactNode; onError: (e: string) => void }) {
  const [max, setMax] = useState(false);
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
    <header className="titlebar">
      <div className="titlebar-brand" data-tauri-drag-region onDoubleClick={run((w) => w.toggleMaximize())}>
        <span className="titlebar-logo" data-tauri-drag-region />
        <span data-tauri-drag-region>Sentinel</span>
      </div>
      <div className="titlebar-tools">{children}</div>
      <div className="titlebar-drag" data-tauri-drag-region onDoubleClick={run((w) => w.toggleMaximize())} />
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
