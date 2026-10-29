// 28px chrome strip, a child webview stacked above every panel's content
// (Task 9b). Stateless: every rect comes from Rust (get/focus_panel).
import { useEffect, useRef, useState } from "react";
import { emitTo } from "@tauri-apps/api/event";
import { registry } from "../core/module";
import { dragRect, resizeRect, type Rect } from "./layout";
import { closePanel, commit, dragMove, dragResize, focusPanel, getPanel, mainClientRect, MIN, SETTINGS_ID } from "./panelApi";
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

type Kind = "move" | "resize";
type Drag = { kind: Kind; sx: number; sy: number; start: Rect; screen: Rect; dx: number; dy: number; raf: number };

export function ChromeRoute({ id }: { id: string }) {
  const m = registry.find((x) => x.id === id);
  const drag = useRef<Drag | null>(null);
  const press = useRef(0); // bumps on every down/up so a late focus reply is dropped
  const [err, setErr] = useState<string | null>(null);
  const fail = (what: string) => (e: unknown) => {
    console.error(what, e);
    setErr(`${what}: ${String(e)}`);
  };

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
    p.catch(fail("drag"));
  };

  const down = (kind: Kind) => async (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (kind === "move" && (e.target as HTMLElement).closest("button"))) return;
    e.stopPropagation(); // the grip sits inside the bar
    setErr(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    const { screenX: sx, screenY: sy } = e;
    drag.current = null;
    const my = ++press.current;
    try {
      const [p, screen] = await Promise.all([focusPanel(id), mainClientRect()]);
      if (my !== press.current) return; // released before focus replied
      drag.current = { kind, sx, sy, start: p.rect, screen, dx: 0, dy: 0, raf: 0 };
    } catch (err) {
      fail("focus")(err);
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
      fail("save")(err);
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
      <span className="panel-chrome-title" style={err ? { color: "#ff7b7b" } : undefined} title={err ?? undefined}>{err ?? (m ? m.name : id === SETTINGS_ID ? "Settings" : id ? id : "Module not found")}</span>
      {m && m.panel !== "web" && (
        <button className="panel-chrome-gear" title="Customize" aria-label="Customize panel"
          onClick={() => emitTo(panelLabel(id), PANEL_CUSTOMIZE, { id }).catch(fail("customize"))}>⚙</button>
      )}
      <button className="panel-chrome-close" title="Close" aria-label="Close panel"
        onClick={() => closePanel(id).catch(fail("close"))}>×</button>
      <span className="panel-chrome-grip" title="Resize" {...handlers("resize")} />
    </div>
  );
}
