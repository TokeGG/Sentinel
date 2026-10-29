import { test } from "node:test";
import assert from "node:assert/strict";
import { BILLS, ROLES, VOTES } from "./fixtures.ts";
import { STAGES, cleanName, parseBills, parseMembers, parseVotes, partyCode, statusStage, timeline } from "./parse.ts";

test("parseBills reads fields, strips number from the title, skips unusable rows, rejects non-http links", () => {
  const b = parseBills(BILLS);
  assert.deepEqual(b.map((x) => x.id), ["101", "102", "103"]);
  assert.equal(b[0].title, "Clean Water Act of 2026");
  assert.equal(b[0].number, "H.R. 1234");
  assert.equal(b[0].sponsor, "Rep. Jane Doe [D-CA12]");
  assert.equal(b[0].statusLabel, "Passed House");
  assert.deepEqual(b[0].history, [{ date: "2026-03-01", text: "Introduced" }, { date: "2026-10-20", text: "Passed House" }]);
  assert.equal(b[1].title, "A bill");
  assert.equal(b[1].sponsor, "Sen. Sam Roe [R-TX]");
  assert.equal(b[1].statusDate, "2026-09-01");
  assert.equal(b[1].link, null);
  assert.equal(b[2].status, "");
});

test("parsers survive junk input", () => {
  for (const bad of [null, undefined, 5, "x", [], {}, { objects: "nope" }]) {
    assert.deepEqual(parseBills(bad), []);
    assert.deepEqual(parseVotes(bad), []);
    assert.deepEqual(parseMembers(bad), []);
  }
});

test("parseVotes", () => {
  const v = parseVotes(VOTES);
  assert.equal(v.length, 2);
  assert.deepEqual([v[0].chamber, v[0].yes, v[0].no, v[0].other, v[0].bill, v[0].votedAt], ["house", 230, 200, 5, "H.R. 1234", "2026-10-20"]);
  assert.deepEqual([v[1].question, v[1].other, v[1].bill], ["Nomination", null, null]);
});

test("parseMembers maps role type, party and state; cleanName drops the bracket tag", () => {
  const m = parseMembers(ROLES);
  assert.deepEqual(m.map((x) => [x.name, x.party, x.state, x.chamber, x.district]), [
    ["Sen. Bernard Sanders", "I", "VT", "senate", null],
    ["Rep. Jane Doe", "D", "CA", "house", 12],
    ["Rep. Joe Roe", "R", "TX", "house", null],
  ]);
  assert.equal(cleanName("Rep. A B [R-OH1]"), "Rep. A B");
  assert.deepEqual(["Democrat", "republican", "Independent", "Libertarian", ""].map(partyCode), ["D", "R", "I", "L", ""]);
});

test("statusStage and timeline", () => {
  assert.deepEqual(statusStage("introduced"), { stage: 0, failed: false });
  assert.deepEqual(statusStage("reported"), { stage: 1, failed: false });
  assert.deepEqual(statusStage("pass_over_house"), { stage: 2, failed: false });
  assert.deepEqual(statusStage("passed_bill"), { stage: 3, failed: false });
  assert.deepEqual(statusStage("enacted_signed"), { stage: 4, failed: false });
  assert.deepEqual(statusStage("prov_kill_suspensionfailed"), { stage: 1, failed: true });
  assert.deepEqual(statusStage("something_new"), { stage: 0, failed: false });
  assert.deepEqual(timeline("pass_over_house").map((s) => s.state), ["done", "done", "current", "todo", "todo"]);
  assert.deepEqual(timeline("fail_originating_house").map((s) => s.state), ["done", "failed", "todo", "todo", "todo"]);
  assert.equal(timeline("x").length, STAGES.length);
});
