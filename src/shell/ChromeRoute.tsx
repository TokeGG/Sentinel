// 28px chrome strip, a child webview stacked above every panel's content
// (Task 9b). Stateless: every rect comes from Rust (get/focus_panel).
import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { registry } from "../core/module";
import { dragRect, resizeRect, type Rect } from "./layout";
import { closePanel, commit, dragMove, dragResize, focusPanel, getPanel, MIN } from "./panelApi";

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

// Panel rects are relative to the MAIN window's client area, so clamp to its
// logical inner size (this webview's own window.inner* is only the strip).
async function mainClientRect(): Promise<Rect> {
  try {
    const w = getCurrentWindow();
    const s = (await w.innerSize()).toLogical(await w.scaleFactor());
    return { x: 0, y: 0, w: s.width, h: s.height };
  } catch {
    return { x: 0, y: 0, w: window.screen.availWidth, h: window.screen.availHeight };
  }
}

type Kind = "move" | "resize";
type Drag = { kind: Kind; sx: number; sy: number; start: Rect; screen: Rect; dx: number; dy: number; raf: number };

export function ChromeRoute({ id }: { id: string }) {
  const m = registry.find((x) => x.id === id);
  const drag = useRef<Drag | null>(null);
  const press = useRef(0); // bumps on every down/up so a late focus reply is dropped

  // A raise (focus_panel on a non-top panel) re-creates this webview before
  // the reply arrives, so the fresh chrome persists the authoritative z here.
  useEffect(() => {
    getPanel(id).then(commit).catch(() => {});
  }, [id]);

  const flush = () => {
    const d = drag.current;
    if (!d) return;
    d.raf = 0;
    const r = (d.kind === "move" ? dragRect : resizeRect)(d.start, d.dx, d.dy, d.screen, MIN);
    const p = d.kind === "move" ? dragMove(id, r.x, r.y) : dragResize(id, r.w, r.h);
    p.catch((e) => console.error("chrome drag", e));
  };

  const down = (kind: Kind) => async (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (kind === "move" && (e.target as HTMLElement).closest("button"))) return;
    e.stopPropagation(); // the grip sits inside the bar
    e.currentTarget.setPointerCapture(e.pointerId);
    const { screenX: sx, screenY: sy } = e;
    drag.current = null;
    const my = ++press.current;
    try {
      const [p, screen] = await Promise.all([focusPanel(id), mainClientRect()]);
      if (my !== press.current) return; // released before focus replied
      drag.current = { kind, sx, sy, start: p.rect, screen, dx: 0, dy: 0, raf: 0 };
    } catch (err) {
      console.error("chrome focus", err);
    }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.dx = e.screenX - d.sx;
    d.dy = e.screenY - d.sy;
    if (!d.raf) d.raf = requestAnimationFrame(flush); // no loop when idle
  };
  const up = async () => {
    press.current++;
    const d = drag.current;
    if (!d) return;
    if (d.raf) cancelAnimationFrame(d.raf);
    flush();
    drag.current = null;
    try {
      await commit(await getPanel(id));
    } catch (err) {
      console.error("chrome commit", err);
    }
  };
  const handlers = (kind: Kind) => ({
    onPointerDown: down(kind),
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: up,
  });

  return (
    <div className="panel-chrome" {...handlers("move")}>
      <span className="panel-chrome-title">{m ? m.name : id ? id : "Module not found"}</span>
      <button className="panel-chrome-close" title="Close" aria-label="Close panel"
        onClick={() => closePanel(id).catch((e) => console.error("close", e))}>×</button>
      <span className="panel-chrome-grip" title="Resize" {...handlers("resize")} />
    </div>
  );
}
