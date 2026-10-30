// Main window: executes shell commands from any webview (palette, keys, tray)
// and keeps nav history / closed stack / pins in sync with panel events.
import { useEffect, useRef } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import type { Rect } from "../layout";
import { getPanel } from "../panelApi";
import { CAPTURE_ID, HELP_ID, PALETTE_ID, SNAP_ID, PANEL_CLOSED, PANEL_FOCUSED, SHELL_CMD } from "./ids";
import type { ShellCmd } from "./keymap";
import { drop, emptyNav, popClosed, pushClosed, step, visit, type Closed } from "./nav";
import { isKnown, moveToNextMonitor, openById, raisePins, saveNamedLayout, switchLayout, tileAll, toggleFocusMode, togglePin } from "./layoutOps";
import type { TilePreset } from "./snap";
import { quickSwitchTarget } from "./collections";
import { getFolders, getGroups, PALETTE_QUERY } from "./collectionsStore";

const isOpen = async (id: string) => (await getPanel(id).catch(() => null))?.state === "open";

export function useShellCommands(fail: (e: unknown) => void) {
  const nav = useRef(emptyNav());
  const closed = useRef<Closed[]>([]);
  useEffect(() => {
    const goto = async (dir: "back" | "fwd") => {
      const open = new Set<string>();
      for (const id of [...nav.current.back, ...nav.current.fwd]) if (await isOpen(id)) open.add(id);
      const next = step(nav.current, dir, (id) => open.has(id));
      if (next?.cur) { nav.current = next; await openById(next.cur); }
    };
    const run = async (c: ShellCmd) => {
      switch (c.type) {
        case "palette": return (await isOpen(PALETTE_ID)) ? import("../panelApi").then((a) => a.closePanel(PALETTE_ID)) : openById(PALETTE_ID);
        case "open": return isKnown(c.id) ? openById(c.id) : undefined;
        case "help": return openById(HELP_ID);
        case "capture": return openById(CAPTURE_ID);
        case "reopen": {
          const open = new Set<string>();
          for (const x of closed.current) if (await isOpen(x.id)) open.add(x.id);
          const r = popClosed(closed.current, (id) => open.has(id));
          closed.current = r.next;
          return r.item ? openById(r.item.id, r.item.rect) : undefined;
        }
        case "back": return goto("back");
        case "forward": return goto("fwd");
        case "focusMode": return toggleFocusMode(nav.current.cur).then(() => {});
        case "tile": return tileAll(c.preset as TilePreset);
        case "layout": return switchLayout(c.name);
        case "saveLayout": return saveNamedLayout(c.name);
        case "pin": { const id = c.id ?? nav.current.cur; return id ? togglePin(id).then(() => {}) : undefined; }
        case "gameMode": return emit("tray-game-mode");
        case "nextMonitor": return moveToNextMonitor();
        case "quickSwitch": {
          const open = new Set<string>();
          for (const id of nav.current.back) if (await isOpen(id)) open.add(id);
          const t = quickSwitchTarget(nav.current.back, (id) => open.has(id));
          return t ? openById(t) : undefined;
        }
        case "group": { for (const id of (await getGroups())[c.name] ?? []) if (isKnown(id)) await openById(id); return; }
        case "smartFolder": {
          const q = (await getFolders())[c.name];
          if (!q) return;
          try { localStorage.setItem(PALETTE_QUERY, q); } catch { /* storage off */ }
          if (await isOpen(PALETTE_ID)) await import("../panelApi").then((a) => a.closePanel(PALETTE_ID));
          return openById(PALETTE_ID);
        }
        case "snapLayouts": {
          const id = c.id ?? nav.current.cur;
          if (!id || id === SNAP_ID) return;
          try { localStorage.setItem("snap_target", id); } catch { /* storage off */ }
          return openById(SNAP_ID);
        }
      }
    };
    const un = [
      listen<ShellCmd>(SHELL_CMD, ({ payload }) => { Promise.resolve(run(payload)).catch(fail); }),
      listen<{ id: string; auto?: boolean }>(PANEL_FOCUSED, ({ payload }) => {
        if (payload.auto || payload.id === PALETTE_ID || payload.id === SNAP_ID) return;
        nav.current = visit(nav.current, payload.id);
        raisePins(payload.id).catch(fail);
      }),
      listen<{ id: string; rect?: Rect }>(PANEL_CLOSED, ({ payload }) => {
        if (payload.id === PALETTE_ID || payload.id === CAPTURE_ID || payload.id === SNAP_ID) return;
        nav.current = drop(nav.current, payload.id);
        closed.current = pushClosed(closed.current, payload);
      }),
      listen("quick-capture", () => openById(CAPTURE_ID).catch(fail)),
    ];
    return () => un.forEach((p) => p.then((f) => f()));
  }, []);
}
