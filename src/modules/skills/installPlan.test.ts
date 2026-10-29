import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffEmpty, diffFiles, diffSummary, LIMITS, planFiles, type TreeEntry } from "./installPlan.ts";

const b = (path: string, size = 10, sha = "s-" + path): TreeEntry => ({ path, type: "blob", size, sha });

describe("planFiles", () => {
  it("keeps text files under the subdir and strips the prefix", () => {
    const p = planFiles([b("README.md"), b("skills/pdf/SKILL.md"), b("skills/pdf/run.py"), b("skills/pdf/img.png"), { path: "skills/pdf", type: "tree", sha: "t" }], "skills/pdf");
    assert.deepEqual(p.files.map((f) => f.path), ["SKILL.md", "run.py"]);
    assert.deepEqual(p.skipped, [{ path: "img.png", reason: "not a text file" }]);
    assert.equal(p.error, undefined);
  });
  it("skips hidden, build, lockfile, oversize and unsafe entries", () => {
    const p = planFiles([b("a.md"), b(".github/x.yml"), b("node_modules/x/i.js"), b("package-lock.json"), b("big.json", LIMITS.file + 1), b("a/../b.md"), b("nul.md"), b(".env")], "");
    assert.deepEqual(p.files.map((f) => f.path), ["a.md"]);
    assert.equal(p.skipped.length, 7);
  });
  it("does not match a sibling dir that merely shares the prefix", () => {
    assert.deepEqual(planFiles([b("skills/pdf-extra/SKILL.md"), b("skills/pdf/SKILL.md")], "skills/pdf").files.map((f) => f.path), ["SKILL.md"]);
  });
  it("reports empty and over-limit plans", () => {
    assert.match(planFiles([b("x.png")], "").error ?? "", /no installable/);
    assert.match(planFiles(Array.from({ length: LIMITS.files + 1 }, (_, i) => b(`f${i}.md`)), "").error ?? "", /file limit/);
    assert.match(planFiles(Array.from({ length: 10 }, (_, i) => b(`f${i}.md`, LIMITS.file)), "").error ?? "", /total size/);
  });
});

describe("diffFiles", () => {
  it("lists added, removed and changed paths", () => {
    const d = diffFiles([{ path: "a", size: 1, sha: "1" }, { path: "b", size: 1, sha: "1" }, { path: "c", size: 1, sha: "1" }],
      [{ path: "a", size: 1, sha: "1" }, { path: "b", size: 2, sha: "2" }, { path: "d", size: 1, sha: "9" }]);
    assert.deepEqual(d, { added: ["d"], removed: ["c"], changed: ["b"] });
    assert.equal(diffSummary(d), "1 added, 1 changed, 1 removed");
    assert.ok(diffEmpty(diffFiles([], [])));
  });
});
