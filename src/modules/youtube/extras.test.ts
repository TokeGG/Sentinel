import { test } from "node:test";
import assert from "node:assert/strict";
import { SUGGESTED, notFollowed } from "./suggestedList.ts";
import { byGroup, continueList, groupMap, newUploads, parsePlayerMsg, playerUrl, rateMsg, total, type Progress } from "./extras.ts";

test("playerUrl enables the JS API and resume point; rejects bad ids", () => {
  const u = playerUrl("dQw4w9WgXcQ", { start: 90.7, origin: "http://tauri.localhost" })!;
  assert.match(u, /enablejsapi=1/);
  assert.match(u, /start=90/);
  assert.match(u, /origin=http%3A%2F%2Ftauri.localhost/);
  assert.equal(playerUrl("bad"), null);
  assert.equal(JSON.parse(rateMsg(1.5)).args[0], 1.5);
});

test("parsePlayerMsg reads infoDelivery only", () => {
  assert.deepEqual(parsePlayerMsg('{"event":"infoDelivery","info":{"currentTime":12.5,"duration":300}}'), { time: 12.5, duration: 300 });
  assert.equal(parsePlayerMsg('{"event":"onReady"}'), null);
  assert.equal(parsePlayerMsg("nope"), null);
  assert.equal(parsePlayerMsg({ event: "infoDelivery", info: { volume: 3 } }), null);
});

test("continueList keeps started, unfinished videos newest first", () => {
  const p = (id: string, seconds: number, duration: number, updatedAt: number): Progress => ({ videoId: id, channelId: null, title: id, seconds, duration, updatedAt });
  const out = continueList([p("a", 10, 600, 5), p("b", 300, 600, 1), p("c", 590, 600, 9), p("d", 100, 0, 3)]);
  assert.deepEqual(out.map((x) => x.videoId), ["d", "b"]);
});

test("newUploads counts per channel after its seen time", () => {
  const v = (c: string, at: string) => ({ videoId: c + at, channelId: c, channel: c, title: "", publishedAt: at });
  const m = newUploads([v("A", "2026-10-02T00:00:00Z"), v("A", "2026-09-01T00:00:00Z"), v("B", "2026-10-02T00:00:00Z")], new Map([["A", Date.parse("2026-10-01T00:00:00Z") / 1000]]));
  assert.deepEqual([...m], [["A", 1]]);
  assert.equal(total(m), 1);
});

test("groups filter by chip", () => {
  const g = groupMap([{ name: "Tech", channelId: "A" }, { name: "Tech", channelId: "B" }, { name: "Music", channelId: "C" }]);
  const xs = [{ channelId: "A" }, { channelId: "C" }, { channelId: null }];
  assert.equal(byGroup(xs, "grp:Tech", g).length, 1);
  assert.equal(byGroup(xs, "all", g).length, 3);
});

test("suggested channels: >= 25 unique @handles, followed ones hidden", () => {
  assert.ok(SUGGESTED.length >= 25);
  assert.equal(new Set(SUGGESTED.map((s) => s.handle.toLowerCase())).size, SUGGESTED.length);
  for (const s of SUGGESTED) assert.match(s.handle, /^@[\w.-]+$/);
  assert.equal(notFollowed(["@MKBHD", null]).length, SUGGESTED.length - 1);
});
