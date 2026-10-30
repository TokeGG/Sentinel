// Pure Terminal home: parses the prompt line into a shell command. Words match a module by id tail
// ("news" -> hub.news) or name, case-insensitive, prefix allowed when unique.
export type Mod = { id: string; name: string };
export type TermCmd = { kind: "open"; id: string } | { kind: "home" } | { kind: "help" } | { kind: "palette" } | { kind: "settings" } | { kind: "clear" } | { kind: "unknown"; text: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const keysOf = (m: Mod) => [norm(m.id.split(".").pop() ?? m.id), norm(m.name)];

export function findModule(word: string, mods: Mod[]): Mod | null {
  const w = norm(word);
  if (!w) return null;
  const exact = mods.find((m) => keysOf(m).includes(w));
  if (exact) return exact;
  const pre = mods.filter((m) => keysOf(m).some((k) => k.startsWith(w)));
  return pre.length === 1 ? pre[0] : null;
}

export function parseCommand(line: string, mods: Mod[]): TermCmd {
  const [head = "", ...rest] = line.trim().split(/\s+/);
  const h = head.toLowerCase(), arg = rest.join(" ");
  if (!h) return { kind: "unknown", text: "" };
  if (h === "help" || h === "?") return { kind: "help" };
  if (h === "home" || h === "hide") return { kind: "home" };
  if (h === "clear" || h === "cls") return { kind: "clear" };
  if (h === "search" || h === "find") return { kind: "palette" };
  if (h === "settings" || h === "config") return { kind: "settings" };
  const m = findModule(h === "open" || h === "cd" ? arg : line, mods);
  return m ? { kind: "open", id: m.id } : { kind: "unknown", text: line.trim() };
}

export const HELP_LINES = ["open <app>   open a panel (or just type its name: news, mail, lab)", "home         hide all panels / bring them back (Ctrl+Space)",
  "search       search everything (Ctrl+K)", "settings     open settings", "clear        clear this log"];

/** Count boxes: modules with a badge above zero, biggest first. */
export function countBoxes(badges: Record<string, number>, mods: Mod[], max = 6): { id: string; name: string; n: number }[] {
  return mods.map((m) => ({ id: m.id, name: m.name, n: badges[m.id] ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, max);
}
