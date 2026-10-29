import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { parseSkillMd } from "./skillMd.ts";

const dir = new URL("../../../resources/skills/", import.meta.url);

test("bundled skills: 15+ general skills, each parses, name = folder, numbered steps, nothing offensive", () => {
  const names = readdirSync(dir);
  assert.ok(names.length >= 18, `${names.length} skills`);
  for (const n of names) {
    const r = parseSkillMd(readFileSync(new URL(`${n}/SKILL.md`, dir), "utf8"));
    assert.ok(r.ok, n);
    if (!r.ok) continue;
    assert.equal(r.skill.name, n);
    assert.ok(r.skill.description.length >= 30, `${n} description`);
    assert.ok((r.skill.body.match(/^\d+\. /gm) ?? []).length >= 4, `${n} has steps`);
    assert.ok(!/exploit|payload|brute.?force|phish|bypass/i.test(r.skill.body + r.skill.description), `${n} offensive wording`);
  }
});

test("bundled skills: every skill has a category, every category has 3+ skills", async () => {
  const { CATEGORIES, parseCategoryList } = await import("../../core/categories.ts");
  const count = new Map<string, number>();
  for (const n of readdirSync(dir)) {
    const r = parseSkillMd(readFileSync(new URL(`${n}/SKILL.md`, dir), "utf8"));
    assert.ok(r.ok);
    if (!r.ok) continue;
    const cats = parseCategoryList(r.skill.meta.category);
    assert.ok(cats.length > 0, `${n} has no category`);
    for (const c of cats) count.set(c, (count.get(c) ?? 0) + 1);
  }
  for (const c of CATEGORIES) assert.ok((count.get(c) ?? 0) >= 3, `${c}: ${count.get(c) ?? 0}`);
});
