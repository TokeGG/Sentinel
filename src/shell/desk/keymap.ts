// Pure in-app shortcut map (works in the main window and in panel webviews).
export type ShellCmd =
  | { type: "palette" } | { type: "reopen" } | { type: "back" } | { type: "forward" }
  | { type: "focusMode" } | { type: "tile"; preset: string } | { type: "open"; id: string }
  | { type: "layout"; name: string } | { type: "saveLayout"; name: string } | { type: "pin"; id?: string }
  | { type: "gameMode" } | { type: "nextMonitor" } | { type: "capture" } | { type: "help" } | { type: "snapLayouts"; id?: string };

export type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };

export function keyToCmd(e: KeyLike): ShellCmd | null {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && !e.shiftKey && !e.altKey && k === "k") return { type: "palette" };
  if (mod && e.shiftKey && k === "t") return { type: "reopen" };
  if (mod && e.shiftKey && k === "f") return { type: "focusMode" };
  if (e.altKey && !mod && k === "arrowleft") return { type: "back" };
  if (e.altKey && !mod && k === "arrowright") return { type: "forward" };
  if (k === "f1" && !mod) return { type: "help" };
  if (mod && e.altKey && !e.shiftKey && k === "z") return { type: "snapLayouts" };
  return null;
}
