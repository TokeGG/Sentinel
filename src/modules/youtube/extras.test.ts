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

// --- pop-out queue + live parser ---
import { buildQueue, clampWidth, current, hasNext, heightFor, isEnded, lockedPanelH, sanitizeQueue, step } from "./queue.ts";
import { liveUrl, parseLivePage, sanitizeLive } from "./live.ts";
const qi = (n: number) => ({ videoId: `vid${String(n).padStart(8, "0")}`, channelId: null, title: `V${n}` });

test("queue: build from the containing list, step, sanitize", () => {
  const q = buildQueue(qi(2), [[qi(9)], [qi(1), qi(2), qi(3), qi(4)]], [qi(7)]);
  assert.deepEqual(q.items.map((i) => i.title), ["V2", "V3", "V4"]);
  const f = buildQueue(qi(5), [[qi(1)]], [qi(5), qi(6)]);
  assert.deepEqual(f.items.map((i) => i.title), ["V5", "V6"]);
  const n = step(q, 1);
  assert.equal(current(n)?.title, "V3");
  assert.equal(step(step(n, 1), 1).index, 2); // stays at end
  assert.equal(step(q, -1), q);
  assert.equal(hasNext(step(n, 1)), false);
  assert.deepEqual(sanitizeQueue("nope"), { items: [], index: 0, at: 0 });
  const s = sanitizeQueue({ items: [qi(1), { videoId: "bad" }], index: 9, at: 12 });
  assert.equal(s.items.length, 1); assert.equal(s.index, 0); assert.equal(s.at, 12);
});

test("isEnded: state 0 only", () => {
  assert.equal(isEnded('{"event":"onStateChange","info":0}'), true);
  assert.equal(isEnded({ event: "infoDelivery", info: { playerState: 0 } }), true);
  assert.equal(isEnded('{"event":"onStateChange","info":1}'), false);
  assert.equal(isEnded("x"), false);
});

test("16:9 sizing", () => {
  assert.equal(heightFor(640), 360);
  assert.equal(clampWidth(100, 800), 320);
  assert.equal(clampWidth(5000, 800), 800);
  assert.equal(clampWidth(NaN, 800), 800);
  assert.equal(lockedPanelH(400, 640, 380, 30), 410);
});

test("live page parser", () => {
  const live = `<link rel="canonical" href="https://www.youtube.com/watch?v=abcdefghijk"><meta name="title" content="Big &amp; Live">{"isLiveNow":true}`;
  assert.deepEqual(parseLivePage(live), { videoId: "abcdefghijk", status: "live", title: "Big & Live", startsAt: null });
  const up = `<link rel="canonical" href="https://www.youtube.com/watch?v=abcdefghijk">"upcomingEventData":{"scheduledStartTime":"1730000000"}`;
  assert.equal(parseLivePage(up)?.status, "upcoming");
  assert.equal(parseLivePage(up)?.startsAt, 1730000000);
  assert.equal(parseLivePage(`<link rel="canonical" href="https://www.youtube.com/channel/UCx">"isLive":true`), null);
  assert.equal(parseLivePage(`<link rel="canonical" href="https://www.youtube.com/watch?v=abcdefghijk">replay`), null);
  assert.match(liveUrl("UC1"), /channel\/UC1\/live$/);
  const s = sanitizeLive(JSON.stringify([{ channelId: "a", videoId: "abcdefghijk", status: "upcoming", startsAt: 5 }, { channelId: "b", videoId: "bbcdefghijk", status: "live" }, { videoId: "x" }]));
  assert.deepEqual(s.map((h) => h.status), ["live", "upcoming"]);
  assert.deepEqual(sanitizeLive("{"), []);
});
