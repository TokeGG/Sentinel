// Mail rules: "from/subject contains X -> move / flag / mark read". Applied on refresh. Pure.
import type { Msg } from "./types.ts";

export type RuleField = "from" | "subject";
export type RuleAction = "move" | "flag" | "read";
export interface Rule { id: number; field: RuleField; needle: string; action: RuleAction; arg: string; enabled: boolean }
export interface RuleStep { msg: Msg; rule: Rule }

export function ruleMatches(r: Rule, m: Msg): boolean {
  const n = r.needle.trim().toLowerCase();
  if (!r.enabled || !n) return false;
  const hay = r.field === "from" ? `${m.fromName} ${m.fromAddr}` : m.subject;
  return hay.toLowerCase().includes(n);
}

/** Steps to run: per message, every matching rule in order; one move at most (first wins), skips no-ops. */
export function planRules(ms: Msg[], rules: Rule[]): RuleStep[] {
  const out: RuleStep[] = [];
  for (const m of ms) {
    let moved = false;
    for (const r of rules) {
      if (!ruleMatches(r, m)) continue;
      if (r.action === "move") { if (moved || !r.arg || r.arg === m.folder) continue; moved = true; }
      if (r.action === "flag" && m.starred) continue;
      if (r.action === "read" && m.seen) continue;
      out.push({ msg: m, rule: r });
    }
  }
  // moves last so flag/read land before the message leaves the folder
  return [...out.filter((s) => s.rule.action !== "move"), ...out.filter((s) => s.rule.action === "move")];
}

export const ruleLabel = (r: Rule) =>
  `${r.field === "from" ? "From" : "Subject"} contains “${r.needle}” → ${r.action === "move" ? `move to ${r.arg}` : r.action === "flag" ? "star" : "mark read"}`;
