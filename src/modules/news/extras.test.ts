import { test } from "node:test";
import assert from "node:assert/strict";
import { audioSrc, boostByTopics, cleanTopic, groupStories, isAudio, PRESETS, reliabilityOk, tickerRows, titleSimilarity, topicsIn } from "./extras.ts";

test("topics: clean, match by all tokens, stable boost", () => {
  assert.equal(cleanTopic("  Rust   Lang "), "rust lang");
  assert.equal(cleanTopic("x"), null);
  assert.deepEqual(topicsIn("New Rust language release", ["rust", "python", "rust release"]), ["rust", "rust release"]);
  const rows = [{ title: "a python thing" }, { title: "rust news" }, { title: "other" }];
  assert.deepEqual(boostByTopics(rows, ["rust"]).map((r) => r.title), ["rust news", "a python thing", "other"]);
  assert.equal(boostByTopics(rows, []), rows);
});

test("duplicate stories group by title similarity", () => {
  assert.ok(titleSimilarity("Apple unveils new iPhone at event", "Apple unveils iPhone at September event") >= 0.5);
  assert.ok(titleSimilarity("Apple unveils iPhone", "Mars rover finds water") < 0.2);
  const g = groupStories([
    { title: "Apple unveils new iPhone at event" },
    { title: "Mars rover finds water" },
    { title: "Apple unveils iPhone at September event" },
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].more.length, 1);
});

test("reliability, audio, presets, ticker", () => {
  assert.ok(reliabilityOk("mixed") && !reliabilityOk("great"));
  assert.ok(isAudio("audio/mpeg", "") && isAudio("", "https://x.org/ep.mp3?a=1") && !isAudio("video/mp4", "https://x/v.mp4"));
  assert.equal(audioSrc("http://x/a.mp3"), null);
  assert.equal(audioSrc("https://x/a.mp3"), "https://x/a.mp3");
  for (const p of Object.values(PRESETS)) for (const f of p.feeds) assert.match(f.url, /^https:\/\//);
  assert.deepEqual(tickerRows([{ tag: "sports", t: 1 }, { tag: "", t: 2 }]).length, 1);
});

test("viewRows", async () => {
  const { viewRows } = await import("./extras.ts");
  const rows = [{ title: "rust 2", later: 1, highlight: "" }, { title: "go", later: 0, highlight: "note" }];
  assert.equal(viewRows(rows, "later", []).length, 1);
  assert.equal(viewRows(rows, "highlights", [])[0].title, "go");
  assert.equal(viewRows(rows, "topics", ["rust"]).length, 1);
  assert.equal(viewRows(rows, "all", []).length, 2);
});
