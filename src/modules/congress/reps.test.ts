import { test } from "node:test";
import assert from "node:assert/strict";
import { billDiff, myReps, parseSeat, parseVoterVotes, seatText, snapOf } from "./reps.ts";

test("parseSeat", () => {
  assert.deepEqual(parseSeat("ca 12"), { state: "CA", district: 12 });
  assert.deepEqual(parseSeat("VT at-large"), { state: "VT", district: 0 });
  assert.deepEqual(parseSeat("tx"), { state: "TX", district: null });
  assert.equal(parseSeat("California"), null);
  assert.equal(seatText({ state: "CA", district: 12 }), "CA-12");
});

test("myReps: two senators + the district's member", () => {
  const m = [
    { id: "1", state: "CA", chamber: "senate", district: null }, { id: "2", state: "CA", chamber: "senate", district: null },
    { id: "3", state: "CA", chamber: "house", district: 12 }, { id: "4", state: "CA", chamber: "house", district: 13 },
    { id: "5", state: "NY", chamber: "senate", district: null },
  ];
  assert.deepEqual(myReps(m, { state: "CA", district: 12 }).map((x) => x.id), ["1", "2", "3"]);
});

test("parseVoterVotes: expanded and bare vote", () => {
  const v = parseVoterVotes({ objects: [
    { option: { value: "Yea" }, vote: { id: 9, question: "On Passage", created: "2026-10-01T10:00:00", link: "https://www.govtrack.us/v/9" } },
    { option: "Nay", vote: 10, created: "2026-10-02" }, { junk: 1 },
  ] });
  assert.deepEqual(v.map((x) => [x.voteId, x.position, x.votedAt]), [["9", "Yea", "2026-10-01"], ["10", "Nay", "2026-10-02"]]);
});

test("billDiff", () => {
  const b = { title: "A", statusLabel: "Passed House", statusDate: "2026-10-01", sponsor: "X", history: [{ date: "2026-10-01", text: "passed" }] };
  const cur = snapOf(b);
  assert.deepEqual(billDiff(null, cur), []);
  assert.deepEqual(billDiff({ ...cur, status: "Introduced" }, cur), [{ field: "Status", from: "Introduced", to: "Passed House" }]);
});
