import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BILLS, ROLES, VOTES } from "./fixtures.ts";
import { parseBills, parseMembers, parseVotes } from "./parse.ts";
import { congressSections, filterBills, filterMembers, filterVotes, followUpdates, matchesQuery, seat, shownTab, splitRows, tallyText } from "./panelLogic.ts";

const bills = parseBills(BILLS).map((b) => ({ ...b, ref: b.id, followed: b.id === "101", unseen: false }));
const members = parseMembers(ROLES).map((m) => ({ ...m, ref: m.id, followed: m.id === "400009" }));
const votes = parseVotes(VOTES).map((v) => ({ ...v, ref: v.id }));

test("matchesQuery ANDs words, ignores case and empty fields", () => {
  assert.ok(matchesQuery(["Clean Water Act", null, "Rep. Jane"], "water jane"));
  assert.ok(!matchesQuery(["Clean Water Act"], "water fire"));
  assert.ok(matchesQuery(["x"], "  "));
});

test("filterBills by text and followed-only", () => {
  assert.deepEqual(filterBills(bills, "water", false).map((b) => b.id), ["101"]);
  assert.deepEqual(filterBills(bills, "", true).map((b) => b.id), ["101"]);
  assert.deepEqual(filterBills(bills, "sam roe", false).map((b) => b.id), ["102"]);
});

test("filterVotes by chamber and text", () => {
  assert.deepEqual(filterVotes(votes, "", "senate").map((v) => v.id), ["9002"]);
  assert.deepEqual(filterVotes(votes, "1234", "").map((v) => v.id), ["9001"]);
});

test("filterMembers puts followed first, then by name; party and followed filters", () => {
  assert.deepEqual(filterMembers([...members], "", false, "").map((m) => m.id), ["400009", "400001", "400003"]);
  assert.deepEqual(filterMembers([...members], "", false, "D").map((m) => m.id), ["400001"]);
  assert.deepEqual(filterMembers([...members], "tx", true, "").map((m) => m.id), ["400009"]);
});

test("tallyText and seat", () => {
  assert.equal(tallyText({ yes: 230, no: 200, other: 5 }), "230 yes · 200 no · 5 other");
  assert.equal(tallyText({ yes: null, no: null, other: null }), "");
  assert.equal(seat(members[1]), "House · CA-12");
  assert.equal(seat(members[0]), "Senate · VT");
});

test("followUpdates flags real status changes only", () => {
  const f = [
    { ref: "101", label: "a", last_status: "introduced" },
    { ref: "102", label: "b", last_status: "prov_kill_suspensionfailed" },
    { ref: "103", label: "c", last_status: "" },
    { ref: "999", label: "gone", last_status: "x" },
  ];
  assert.deepEqual(followUpdates(f, parseBills(BILLS)), [{ ref: "101", status: "pass_over_house" }]);
});

test("shownTab falls back to the first visible list section", () => {
  assert.equal(shownTab(["bills", "votes"], "votes"), "votes");
  assert.equal(shownTab(["votes", "members"], "bills"), "votes");
  assert.equal(shownTab(["sync"], "bills"), null);
});

test("splitRows groups by kind", () => {
  const s = splitRows([{ kind: "bill" }, { kind: "vote" }, { kind: "member" }, { kind: "bill" }, { kind: "?" }]);
  assert.deepEqual([s.bills.length, s.votes.length, s.members.length], [2, 1, 1]);
});

test("section ids match Panel.tsx", () => {
  const src = ["Panel.tsx"].map((f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8")).join("");
  const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(used, congressSections.map((s) => s.id).sort());
});
