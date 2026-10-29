// Pure SKILL.md reader: YAML-ish frontmatter (flat `key: value`, optional
// indented continuation lines) between --- fences, then a markdown body.
export interface SkillDoc {
  name: string;
  description: string;
  module: string; // optional `module:` = per-module bundle ("" = general)
  meta: Record<string, string>;
  body: string;
}
export type SkillParse = { ok: true; skill: SkillDoc } | { ok: false; error: string };

const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const unquote = (v: string) => (/^(["']).*\1$/.test(v) && v.length >= 2 ? v.slice(1, -1) : v);

export function parseSkillMd(text: string): SkillParse {
  const t = String(text ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/.exec(t);
  if (!m) return { ok: false, error: "SKILL.md must start with a --- frontmatter block" };
  const meta: Record<string, string> = {};
  let key = "";
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z][\w-]*):[ \t]*(.*)$/.exec(line);
    if (kv) {
      key = kv[1].toLowerCase();
      meta[key] = /^[>|][+-]?$/.test(kv[2].trim()) ? "" : unquote(kv[2].trim());
    } else if (key && /^[ \t]+\S/.test(line)) {
      meta[key] = `${meta[key]} ${line.trim()}`.trim();
    } else if (line.trim() && !line.trim().startsWith("#")) {
      return { ok: false, error: `unreadable frontmatter line: ${line.slice(0, 60)}` };
    }
  }
  if (!meta.name) return { ok: false, error: "frontmatter needs a name" };
  if (!NAME.test(meta.name)) return { ok: false, error: "name must be lowercase letters, digits, - or _ (max 64)" };
  if (!meta.description) return { ok: false, error: "frontmatter needs a description" };
  return { ok: true, skill: { name: meta.name, description: meta.description, module: meta.module ?? "", meta, body: m[2].trim() } };
}
