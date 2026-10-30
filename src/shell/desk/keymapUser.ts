// Pure rebindable in-app shortcuts. app_settings `keymap` holds a JSON
// {action: "Ctrl+K"} override map; defaults below. Conflicts are rejected.
import type { KeyLike, ShellCmd } from "./keymap.ts";

export const ACTIONS: Record<string, { label: string; def: string; cmd: ShellCmd }> = {
  palette: { label: "Command palette", def: "Ctrl+K", cmd: { type: "palette" } },
  reopen: { label: "Reopen closed panel", def: "Ctrl+Shift+T", cmd: { type: "reopen" } },
  focusMode: { label: "Focus mode", def: "Ctrl+Shift+F", cmd: { type: "focusMode" } },
  back: { label: "Back", def: "Alt+ArrowLeft", cmd: { type: "back" } },
  forward: { label: "Forward", def: "Alt+ArrowRight", cmd: { type: "forward" } },
  help: { label: "Help", def: "F1", cmd: { type: "help" } },
  snapLayouts: { label: "Snap layouts", def: "Ctrl+Alt+Z", cmd: { type: "snapLayouts" } },
  quickSwitch: { label: "Switch last two panels", def: "Alt+Q", cmd: { type: "quickSwitch" } },
};
export type Keymap = Record<string, string>;
const MODS = ["Ctrl", "Alt", "Shift"];

/** Canonical combo text ("ctrl + k" -> "Ctrl+K"), "" = unbound, null = invalid. */
export function normCombo(s: string): string | null {
  const t = s.trim();
  if (!t) return "";
  const parts = t.split("+").map((p) => p.trim()).filter(Boolean);
  const mods = new Set<string>();
  let key = "";
  for (const p of parts) {
    const m = MODS.find((x) => x.toLowerCase() === p.toLowerCase() || (x === "Ctrl" && /^(control|cmd|meta)$/i.test(p)));
    if (m) mods.add(m);
    else if (key) return null;
    else key = p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1);
  }
  if (!key) return null;
  if (key.length === 1 && !mods.has("Ctrl") && !mods.has("Alt")) return null; // plain letters would eat typing
  return [...MODS.filter((m) => mods.has(m)), key].join("+");
}
export function comboOf(e: KeyLike): string {
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [e.ctrlKey || e.metaKey ? "Ctrl" : "", e.altKey ? "Alt" : "", e.shiftKey ? "Shift" : "", k].filter(Boolean).join("+");
}
/** Effective map: defaults overlaid with valid user entries. */
export function effective(user: unknown): Keymap {
  const out: Keymap = {};
  const u = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  for (const [a, v] of Object.entries(ACTIONS)) {
    const c = typeof u[a] === "string" ? normCombo(u[a] as string) : null;
    out[a] = c === null ? v.def : c;
  }
  return out;
}
/** Rebind one action; returns the new map or an error naming the conflict. */
export function rebind(map: Keymap, action: string, combo: string): { map: Keymap } | { error: string } {
  if (!ACTIONS[action]) return { error: `Unknown action ${action}` };
  const c = normCombo(combo);
  if (c === null) return { error: `"${combo}" is not a valid shortcut (needs Ctrl or Alt with a letter)` };
  const clash = c ? Object.entries(map).find(([a, v]) => a !== action && v === c) : undefined;
  if (clash) return { error: `${c} is already used by "${ACTIONS[clash[0]].label}"` };
  return { map: { ...map, [action]: c } };
}
export function cmdFor(map: Keymap, e: KeyLike): ShellCmd | null {
  const c = comboOf(e);
  const hit = Object.entries(map).find(([, v]) => v && v === c);
  return hit ? ACTIONS[hit[0]].cmd : null;
}
