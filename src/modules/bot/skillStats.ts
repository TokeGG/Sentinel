// Skill usage stats from run logs (each saved episode lists the skills it was given): most used, never used, failing.
// Pure.
import type { Outcome } from "./actions.ts";

export interface StatEpisode { skills?: string[]; outcome: Outcome; thumbs?: "up" | "down" }
export interface SkillStat { name: string; uses: number; fails: number; failRate: number }
export interface SkillStats { used: SkillStat[]; never: string[]; failing: SkillStat[] }

const counted = (o: Outcome) => o !== "dry" && o !== "cancelled";
const failed = (e: StatEpisode) => e.outcome !== "done" || e.thumbs === "down";

/** `enabled` = names of enabled skills. Failing = at least `minUses` counted runs and a fail rate >= `rate`. */
export function skillStats(eps: StatEpisode[], enabled: string[], minUses = 2, rate = 0.5): SkillStats {
  const m = new Map<string, { uses: number; fails: number }>();
  for (const e of eps) {
    if (!counted(e.outcome) || !Array.isArray(e.skills)) continue;
    for (const name of new Set(e.skills)) {
      if (typeof name !== "string") continue;
      const s = m.get(name) ?? { uses: 0, fails: 0 };
      s.uses++; if (failed(e)) s.fails++;
      m.set(name, s);
    }
  }
  const used = [...m.entries()].map(([name, s]) => ({ name, ...s, failRate: s.uses ? s.fails / s.uses : 0 }))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
  return {
    used,
    never: enabled.filter((n) => !m.has(n)).sort(),
    failing: used.filter((s) => s.uses >= minUses && s.failRate >= rate).sort((a, b) => b.failRate - a.failRate || b.uses - a.uses),
  };
}

export const pct = (r: number) => `${Math.round(r * 100)}%`;
