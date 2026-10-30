// Pure Terminal home: parses the prompt line into a shell command. Words match a module by id tail
// ("news" -> hub.news) or name, case-insensitive, prefix allowed when unique.
export type Mod = { id: string; name: string };
export type TermCmd = { kind: "open"; id: string } | { kind: "home" } | { kind: "help" } | { kind: "palette" } | { kind: "settings" } | { kind: "clear" } | { kind: "note"; text: string } | { kind: "todo"; text: string } | { kind: "timer"; minutes: number; label: string } | { kind: "clip"; q?: string } | { kind: "stats" } | { kind: "unknown"; text: string };

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
  if (h === "note" && arg) return { kind: "note", text: arg };
  if ((h === "todo" || h === "task") && arg) return { kind: "todo", text: arg };
  if (h === "clip" || h === "clipboard") return arg ? { kind: "clip", q: arg } : { kind: "clip" };
  if (h === "stats" || h === "pc") return { kind: "stats" };
  if (h === "timer") {
    const n = Number(rest[0]);
    if (Number.isFinite(n) && n > 0 && n <= 600) return { kind: "timer", minutes: n, label: rest.slice(1).join(" ") || `${n} min` };
  }
  const m = findModule(h === "open" || h === "cd" ? arg : line, mods);
  return m ? { kind: "open", id: m.id } : { kind: "unknown", text: line.trim() };
}

export const VERBS = ["open", "home", "search", "settings", "clear", "help", "note", "todo", "timer", "clip", "stats", "folder", "group"];

/** Replace a leading alias word ("m" -> "open mail"); one level only. */
export function expandAlias(line: string, aliases: Record<string, string>): string {
  const m = line.trim().match(/^(\S+)(.*)$/);
  const to = m && aliases[m[1].toLowerCase()];
  return to ? to + m![2] : line;
}

/** Tab completion: the unique completion of the last word (verbs, aliases, app names), else the common prefix. */
export function complete(line: string, mods: Mod[], aliases: Record<string, string> = {}): string {
  const parts = line.split(" ");
  const last = parts.pop() ?? "";
  if (!last) return line;
  const pool = [...(parts.length ? [] : [...VERBS, ...Object.keys(aliases)]), ...mods.map((m) => m.id.split(".").pop() ?? m.id)];
  const hits = [...new Set(pool.filter((w) => w.startsWith(last.toLowerCase())))];
  if (!hits.length) return line;
  let pre = hits[0];
  for (const h of hits) while (!h.startsWith(pre)) pre = pre.slice(0, -1);
  return [...parts, hits.length === 1 ? hits[0] + " " : pre].join(" ");
}

/** Up/down through history; idx = hist.length means "fresh line". */
export function histStep(hist: string[], idx: number, dir: -1 | 1): number {
  return Math.max(0, Math.min(hist.length, idx + dir));
}

export const HELP_LINES = ["note <text>  save a note · todo <text>  add a task · timer <min> [label]", "clip [text]  search clipboard history · stats  CPU/RAM/disk · folder <name> / group <name>","open <app>   open a panel (or just type its name: news, mail, lab)", "home         hide all panels / bring them back (Ctrl+Space)",
  "search       search everything (Ctrl+K)", "settings     open settings", "clear        clear this log"];

/** Count boxes: modules with a badge above zero, biggest first. */
export function countBoxes(badges: Record<string, number>, mods: Mod[], max = 6): { id: string; name: string; n: number }[] {
  return mods.map((m) => ({ id: m.id, name: m.name, n: badges[m.id] ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, max);
}
