// Pure Terminal home prefs (app_settings `term_prefs`, JSON): prompt text, aliases, hidden boxes, world clocks.
export const TERM_BOXES = ["today", "feed", "counts", "clocks", "timers", "later", "apps"] as const;
export type TermBox = (typeof TERM_BOXES)[number];
export interface TermPrefs { prompt: string; aliases: Record<string, string>; hidden: TermBox[]; clocks: string[]; order: TermBox[] }
export const DEFAULT_TERM: TermPrefs = { prompt: "sentinel@home ~ $", aliases: {}, hidden: [], clocks: [], order: [...TERM_BOXES] };

const isBox = (v: unknown): v is TermBox => typeof v === "string" && (TERM_BOXES as readonly string[]).includes(v);
export const validZone = (z: string) => { try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; } };

export function sanitizeTerm(v: unknown): TermPrefs {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const prompt = typeof o.prompt === "string" && o.prompt.trim() ? o.prompt.trim().slice(0, 40) : DEFAULT_TERM.prompt;
  const aliases: Record<string, string> = {};
  if (o.aliases && typeof o.aliases === "object")
    for (const [k, val] of Object.entries(o.aliases as Record<string, unknown>).slice(0, 50))
      if (/^[a-z0-9]{1,12}$/i.test(k) && typeof val === "string" && val.trim()) aliases[k.toLowerCase()] = val.trim().slice(0, 80);
  const hidden = Array.isArray(o.hidden) ? [...new Set(o.hidden.filter(isBox))] : [];
  const clocks = Array.isArray(o.clocks) ? o.clocks.filter((z): z is string => typeof z === "string" && validZone(z)).slice(0, 6) : [];
  const seen = Array.isArray(o.order) ? [...new Set(o.order.filter(isBox))] : [];
  return { prompt, aliases, hidden, clocks, order: [...seen, ...TERM_BOXES.filter((b) => !seen.includes(b))] };
}
export const parseTerm = (s: string | null): TermPrefs => { try { return sanitizeTerm(JSON.parse(s ?? "{}")); } catch { return { ...DEFAULT_TERM }; } };

/** "a=b, c=d" text field <-> aliases record. */
export function parseAliases(text: string): Record<string, string> {
  return sanitizeTerm({ aliases: Object.fromEntries(text.split(/[,\n]/).map((p) => p.split("=").map((x) => x.trim())).filter((p) => p.length === 2)) }).aliases;
}
export const aliasText = (a: Record<string, string>) => Object.entries(a).map(([k, v]) => `${k}=${v}`).join(", ");

export function clockLines(now: Date, zones: string[]): string[] {
  return zones.map((z) => `${z.split("/").pop()!.replace(/_/g, " ").toLowerCase()} ${new Intl.DateTimeFormat("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit" }).format(now)}`);
}
