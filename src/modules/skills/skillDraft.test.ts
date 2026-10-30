import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDraft, draftMessages, draftToMarkdown, localSkillId, slugName } from "./skillDraft.ts";
import { parseSkillMd } from "./skillMd.ts";

describe("skill builder", () => {
  it("prompt carries the task as data", () => {
    const m = draftMessages("compare laptops", "deals");
    assert.equal(m[0].role, "system");
    assert.match(m[1].content, /compare laptops[\s\S]*deals/);
  });
  it("model JSON -> valid SKILL.md", () => {
    const md = draftToMarkdown(JSON.stringify({ name: "Compare Laptops!", description: "Compare two laptops.", category: "deals", steps: ["1. Open both pages", "List specs"], notes: ["no buying"] }), "x");
    const p = parseSkillMd(md);
    assert.ok(p.ok);
    if (p.ok) { assert.equal(p.skill.name, "compare-laptops"); assert.equal(p.skill.meta.category, "deals"); assert.match(p.skill.body, /1\. Open both pages\n2\. List specs/); }
  });
  it("garbage reply still yields an editable draft", () => {
    const p = parseSkillMd(draftToMarkdown("not json", "Plan my week"));
    assert.ok(p.ok && p.skill.name === "plan-my-week" && p.skill.meta.category === "productivity");
  });
  it("checks before save", () => {
    const md = draftToMarkdown("{}", "do things");
    const ok = checkDraft(md, []);
    assert.ok(ok.ok && ok.id === "local-do-things");
    assert.equal(checkDraft(md, ["do-things"]).ok, false);
    assert.equal(checkDraft("no frontmatter", []).ok, false);
    assert.equal(checkDraft(md + "\napi_key: abcdefghijk\n", []).ok, false);
    assert.equal(checkDraft("---\nname: a\ndescription: b\n---\n", []).ok, false);
    const w = checkDraft("---\nname: a\ndescription: b\ncategory: nope\n---\nbody", []);
    assert.ok(w.ok && w.warnings.length === 1);
  });
  it("ids are valid directory ids", () => {
    assert.equal(slugName("--Hi There__"), "hi-there");
    assert.match(localSkillId("x".repeat(80)), /^local-x+$/);
    assert.ok(localSkillId("x".repeat(80)).length <= 64);
  });
});
