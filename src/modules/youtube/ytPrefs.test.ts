import { it } from "node:test";
import assert from "node:assert/strict";
import { addClip, clipsFor, fmtTime, inOutro, isClip, isShort, readSkip, removeClip, seekMsg, startAt, volumeMsg } from "./ytPrefs.ts";

it("detects Shorts by title tag or link", () => {
  assert.equal(isShort("Funny cat #shorts"), true);
  assert.equal(isShort("Cat", "https://youtube.com/shorts/abc"), true);
  assert.equal(isShort("A long video about shortsighted policy"), false);
});
it("adds, lists and removes clips", () => {
  let all = addClip([], { videoId: "v", t: 90.7, label: " goal ", at: 1 });
  all = addClip(all, { videoId: "v", t: 10, label: "start", at: 2 });
  all = addClip(all, { videoId: "v", t: 90, label: "goal 2", at: 3 });
  assert.deepEqual(clipsFor(all, "v").map((c) => [c.t, c.label]), [[10, "start"], [90, "goal 2"]]);
  assert.equal(removeClip(all, "v", 10).length, 1);
  assert.equal(isClip({ videoId: "v", t: 1, label: "", at: 0 }), true);
  assert.equal(isClip({ videoId: "v" }), false);
});
it("formats time", () => {
  assert.equal(fmtTime(75), "1:15");
  assert.equal(fmtTime(3725), "1:02:05");
});
it("skip prefs", () => {
  assert.deepEqual(readSkip({ c: { intro: 5000, outro: 20 }, bad: { intro: "x" } }), { c: { intro: 600, outro: 20 } });
  assert.equal(startAt(0, 30), 30);
  assert.equal(startAt(120, 30), 120);
  assert.equal(inOutro(590, 600, 15), true);
  assert.equal(inOutro(500, 600, 15), false);
  assert.equal(inOutro(590, 0, 15), false);
});
it("player messages", () => {
  assert.equal(JSON.parse(volumeMsg(150)).args[0], 100);
  assert.deepEqual(JSON.parse(seekMsg(12)).args, [12, true]);
});
