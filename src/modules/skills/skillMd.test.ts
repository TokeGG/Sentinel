import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSkillMd } from "./skillMd.ts";

describe("parseSkillMd", () => {
  it("reads frontmatter and body", () => {
    const r = parseSkillMd('---\nname: deal-search\ndescription: "Find deals"\nmodule: hub.deals\n---\n\n# Steps\n1. go\n');
    assert.ok(r.ok);
    assert.equal(r.skill.name, "deal-search");
    assert.equal(r.skill.description, "Find deals");
    assert.equal(r.skill.module, "hub.deals");
    assert.equal(r.skill.body, "# Steps\n1. go");
  });
  it("handles CRLF, BOM, folded descriptions and comments", () => {
    const r = parseSkillMd("﻿---\r\nname: a_b\r\n# note\r\ndescription: >\r\n  one\r\n  two\r\n---\r\nbody");
    assert.ok(r.ok);
    assert.equal(r.skill.description, "one two");
    assert.equal(r.skill.body, "body");
    assert.equal(r.skill.module, "");
  });
  it("rejects missing or bad fields", () => {
    for (const bad of ["no frontmatter", "---\nname: x\n---\n", "---\ndescription: d\n---\n", "---\nname: Bad Name\ndescription: d\n---\n",
      "---\nname: ../x\ndescription: d\n---\n", "---\nname: x\ndescription: d\n???\n---\n", "", "---\nname: x\ndescription: d\n"])
      assert.equal(parseSkillMd(bad).ok, false, JSON.stringify(bad));
    assert.equal(parseSkillMd(undefined as unknown as string).ok, false);
  });
});
