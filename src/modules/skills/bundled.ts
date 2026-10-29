// Skills shipped inside the app: resources/skills/<name>/SKILL.md (plain markdown), embedded at build time.
import { parseSkillMd, type SkillDoc } from "./skillMd";

const raw = import.meta.glob("/resources/skills/*/SKILL.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const bundledSkills: SkillDoc[] = Object.values(raw).flatMap((text) => {
  const r = parseSkillMd(text);
  return r.ok ? [r.skill] : [];
});
