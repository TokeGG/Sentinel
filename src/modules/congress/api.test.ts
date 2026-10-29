import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsonOrError, requireObjects } from "./apiResult.ts";
import { parseLegislators } from "./legislators.ts";

describe("GovTrack reply handling", () => {
  const U = "https://www.govtrack.us/api/v2/bill?limit=60";
  it("parses JSON and reports non-2xx with status, url (no query) and text", () => {
    assert.deepEqual(jsonOrError(U, 200, "application/json", '{"objects":[]}'), { objects: [] });
    assert.throws(() => jsonOrError(U, 503, "text/html", "<h1>Service down</h1>"), /HTTP 503 from https:\/\/www\.govtrack\.us\/api\/v2\/bill: Service down/);
  });
  it("an HTML page with 200 is a readable error, not 'Unexpected token <'", () => {
    assert.throws(() => jsonOrError(U, 200, "text/html", "<html><p>The API has moved</p></html>"), /did not return JSON \(text\/html\): The API has moved/);
  });
  it("requireObjects rejects replies without an objects list", () => {
    assert.throws(() => requireObjects(U, { error: "x" }), /no "objects" list/);
    assert.deepEqual(requireObjects(U, { objects: [1] }), { objects: [1] });
  });
});

describe("congress-legislators fallback", () => {
  it("maps current terms to members with GovTrack ids", () => {
    const m = parseLegislators([
      { id: { govtrack: 400003 }, name: { official_full: "Bernard Sanders" }, terms: [{ type: "rep" }, { type: "sen", state: "VT", party: "Independent", url: "https://www.sanders.senate.gov" }] },
      { id: { govtrack: 412000 }, name: { first: "Jane", last: "Doe" }, terms: [{ type: "rep", state: "ca", district: 12, party: "Democrat" }] },
      { id: {}, name: { official_full: "No Id" }, terms: [{ type: "sen" }] },
      "junk",
    ]);
    assert.deepEqual(m.map((x) => [x.id, x.name, x.chamber, x.state, x.district, x.party]), [
      ["400003", "Sen. Bernard Sanders", "senate", "VT", null, "I"], ["412000", "Rep. Jane Doe", "house", "CA", 12, "D"]]);
    assert.equal(m[1].link, "https://www.govtrack.us/congress/members/412000");
    assert.deepEqual(parseLegislators({}), []);
  });
});
