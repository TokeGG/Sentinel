// Pure decisions for tray / toasts / hotkeys. Counts only, never message text.
const MODS = ["ctrl", "control", "alt", "shift", "super", "cmd", "commandorcontrol", "cmdorctrl"];

/** Normalise "ctrl + shift + space" -> "Ctrl+Shift+Space"; "" = off; null = invalid. */
export function normalizeHotkey(s: string): string | null {
  const parts = s.split("+").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1).map((m) => m.toLowerCase());
  if (mods.length === 0 || mods.some((m) => !MODS.includes(m)) || MODS.includes(key.toLowerCase())) return null;
  if (!/^([a-z0-9]|f([1-9]|1[0-9]|2[0-4])|space|enter|tab|escape|backquote|arrow(up|down|left|right))$/i.test(key)) return null;
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1).toLowerCase();
  const label = (m: string) => (m === "control" ? "Ctrl" : m === "cmdorctrl" || m === "commandorcontrol" ? "CmdOrCtrl" : cap(m));
  return [...new Set(mods.map(label))].concat(key.length === 1 ? key.toUpperCase() : cap(key)).join("+");
}

/** Toast text when the unread total rose (null = no toast). */
export function toastFor(prev: number, next: number, enabled: boolean, muted: boolean): string | null {
  if (!enabled || muted || next <= prev) return null;
  const n = next - prev;
  return `${n} new notification${n === 1 ? "" : "s"} (${next} unread)`;
}
