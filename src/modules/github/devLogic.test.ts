import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ciVerdict, failingCount, inboxRows, parseStatus, readmePrompt, statusText, weeklyTotals } from "./devLogic.ts";

describe("devLogic", () => {
  it("parses porcelain status", () => {
    const s = parseStatus("## main...origin/main [ahead 2, behind 1]\n M src/a.ts\nA  b.ts\n?? new.txt\n");
    assert.deepEqual([s.branch, s.ahead, s.behind, s.changed, s.untracked], ["main", 2, 1, 2, 1]);
    assert.equal(statusText(s), "main ↑2 ↓1 · 2 changed · 1 untracked");
    assert.equal(parseStatus("## No commits yet on dev\n").branch, "dev");
  });
  it("CI verdicts", () => {
    assert.equal(ciVerdict(undefined), "none");
    assert.equal(ciVerdict({ status: "in_progress" }), "running");
    assert.equal(ciVerdict({ status: "completed", conclusion: "success" }), "success");
    assert.equal(ciVerdict({ status: "completed", conclusion: "failure" }), "failure");
    assert.equal(failingCount({ a: "failure", b: "success", c: "failure" }), 2);
  });
  it("inbox, stats, prompt", () => {
    const r = inboxRows([{ id: 1, title: "x", html_url: "u", number: 3, repository_url: "https://api.github.com/repos/me/r", pull_request: {}, updated_at: "2026-01-01" }, { id: 2, title: "y", updated_at: "2026-02-01" }]);
    assert.equal(r[0].kind, "Issue");
    assert.equal(r[1].repo, "me/r");
    assert.equal(r[1].kind, "PR");
    assert.deepEqual(weeklyTotals([{ total: 3 }, { total: "x" }]), [3, 0]);
    assert.deepEqual(weeklyTotals({}), []);
    const p = readmePrompt("me/r", ["package.json"], '{"description":"A tool","scripts":{"build":"x"}}');
    assert.match(p, /A tool/);
    assert.match(p, /build/);
    assert.doesNotMatch(readmePrompt("n", [], "{bad"), /Description/);
  });
});
