// Per-site notebook: what the bot learned about each host. Notes are user-editable text in bot_site_notes; the note
// of the current page's host goes into the prompt as data. Pure.
import type { Episode } from "./actions.ts";
import type { Llm } from "./llm.ts";

export interface SiteNote { host: string; text: string; updated_at?: string }
export const MAX_SITE_NOTE = 2000;

export function hostOf(url: string): string {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase().replace(/^www\./, "") : ""; } catch { return ""; }
}

/** Wrap a model so each decision sees the notebook entry of the page it is on. */
export function withSiteNotes(llm: Llm, notes: SiteNote[]): Llm {
  const by = new Map(notes.map((n) => [n.host, n.text]));
  return {
    ...llm,
    decide(i, signal) {
      const t = by.get(hostOf(i.obs.url));
      return llm.decide(t ? { ...i, notes: [...i.notes, `Site notebook for ${hostOf(i.obs.url)}: ${t.slice(0, 600)}`] } : i, signal);
    },
  };
}

/** New lines learned from one run, per host: dead clicks, refused/blocked steps and how a finished goal went. */
export function siteLessons(ep: Episode): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (h: string, line: string) => { if (h && !(out.get(h) ?? []).includes(line)) out.set(h, [...(out.get(h) ?? []), line]); };
  for (const s of ep.steps) {
    const h = hostOf(s.url ?? "");
    if (s.el && !s.ok && s.error === "no page change after action") add(h, `Clicking ${s.el.role} "${s.el.text.slice(0, 40)}" did nothing.`);
    if (s.ok && s.el && s.action?.type === "type") add(h, `Typing into ${s.el.role} "${s.el.text.slice(0, 40)}" worked.`);
  }
  const withUrl = ep.steps.filter((s) => s.url), last = withUrl[withUrl.length - 1];
  if (ep.outcome === "done" && last) add(hostOf(last.url!), `Reached "${ep.goal.slice(0, 60)}" in ${ep.steps.length} steps.`);
  return out;
}

/** Appends new lines (no duplicates), keeps the newest text within the cap. */
export function mergeSiteNote(old: string, lines: string[]): string {
  const have = new Set(old.split("\n").map((l) => l.trim()).filter(Boolean));
  const fresh = lines.filter((l) => !have.has(l));
  const all = [old.trim(), ...fresh].filter(Boolean).join("\n");
  return all.length > MAX_SITE_NOTE ? all.slice(all.length - MAX_SITE_NOTE).replace(/^[^\n]*\n/, "") : all;
}
