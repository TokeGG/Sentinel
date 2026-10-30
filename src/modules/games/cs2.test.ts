import { it } from "node:test";
import assert from "node:assert/strict";
import { hltvRows, isMatch, liveCount, matchList } from "./cs2Logic.ts";

const H = 3600000;
const ms = [
  { id: "a", teams: "A vs B", event: "Major", start: 10 * H },
  { id: "b", teams: "C vs D", event: "Major", start: 2 * H },
  { id: "c", teams: "E vs F", event: "Old", start: 0 },
];
it("orders live first, then upcoming; drops finished", () => {
  const out = matchList(ms, 3, 3 * H);
  assert.deepEqual(out.map((m) => [m.id, m.live]), [["b", true], ["a", false]]);
  assert.equal(matchList(ms, 3, 3 * H, true).length, 3);
  assert.equal(liveCount(ms, 3, 3 * H), 1);
});
it("validates stored matches", () => {
  assert.equal(isMatch(ms[0]), true);
  assert.equal(isMatch({ id: "x", teams: "t", event: "e", start: "soon" }), false);
});
it("picks HLTV rows", () => {
  const rows = [{ link: "https://www.hltv.org/news/1" }, { link: "https://pcgamer.com/x" }, { link: "https://x.y", source_url: "https://www.hltv.org/rss/news" }];
  assert.equal(hltvRows(rows).length, 2);
});
