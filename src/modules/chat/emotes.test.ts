import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSets, tokenize, type EmoteSet } from "./emotes.ts";
import { bttv, ffz, sevenTv } from "./emoteNorm.ts";

const set: EmoteSet = new Map([["PogU", { url: "https://x/p" }], ["widepeepo", { url: "https://x/w", zeroWidth: true }]]);

test("third-party words become emotes; text is merged", () => {
  const s = tokenize("hello PogU there PogUU", [], set);
  assert.deepEqual(s.map((x) => x.t === "text" ? x.text : `<${x.name}>`), ["hello ", "<PogU>", " there PogUU"]);
});
test("lookup is case-sensitive and whole-word", () => {
  assert.equal(tokenize("pogu", [], set).length, 1);
  assert.equal(tokenize("PogU,", [], set).every((x) => x.t === "text"), true);
});
test("native ranges (code points) win and keep surrounding text", () => {
  const nat = [{ name: "Kappa", url: "https://n/k", start: 3, end: 7 }];
  const s = tokenize("😀😀 Kappa PogU", nat, set);
  assert.deepEqual(s.map((x) => x.t === "text" ? x.text : `<${x.name}>`), ["😀😀 ", "<Kappa>", " ", "<PogU>"]);
});
test("overlapping/out-of-range native ranges are skipped", () => {
  const nat = [
    { name: "a", url: "u", start: 0, end: 2 },
    { name: "b", url: "u", start: 1, end: 3 },
    { name: "c", url: "u", start: 5, end: 99 },
  ];
  const s = tokenize("abcd", nat, new Map());
  assert.deepEqual(s.map((x) => x.t === "text" ? x.text : `<${x.name}>`), ["<a>", "d"]);
});
test("zero-width flag is carried", () => {
  const s = tokenize("widepeepo", [], set)[0];
  assert.equal(s.t === "emote" && s.zeroWidth, true);
});
test("mergeSets: earlier set wins", () => {
  const a: EmoteSet = new Map([["x", { url: "https://a" }]]);
  const b: EmoteSet = new Map([["x", { url: "https://b" }], ["y", { url: "https://b" }]]);
  const m = mergeSets(a, b);
  assert.equal(m.get("x")!.url, "https://a");
  assert.equal(m.size, 2);
});
test("7TV: set and user shapes, zero-width flag, bad entries skipped", () => {
  const e = (name: string, flags = 0) => ({ id: "1", name, flags, data: { host: { url: "//cdn.7tv.app/emote/1" } } });
  const g = sevenTv({ emotes: [e("A"), e("B", 1), { name: "bad", data: {} }] });
  assert.equal(g.get("A")!.url, "https://cdn.7tv.app/emote/1/1x.webp");
  assert.equal(g.get("B")!.zeroWidth, true);
  assert.equal(g.has("bad"), false);
  assert.equal(sevenTv({ emote_set: { emotes: [e("C")] } }).has("C"), true);
  assert.equal(sevenTv(null).size, 0);
});
test("BTTV: global array and user object", () => {
  assert.equal(bttv([{ id: "abc", code: "OMEGALUL", imageType: "png" }]).get("OMEGALUL")!.url, "https://cdn.betterttv.net/emote/abc/1x");
  assert.equal(bttv({ channelEmotes: [{ id: "a1", code: "X" }], sharedEmotes: [{ id: "b2", code: "Y" }] }).size, 2);
  assert.equal(bttv([{ id: "../x", code: "Z" }]).size, 0);
});
test("FFZ: default_sets (global) and room.set", () => {
  const sets = { "3": { emoticons: [{ name: "ZrehplaR", urls: { "1": "//cdn.frankerfacez.com/a/1" } }] }, "9": { emoticons: [{ name: "R", urls: { "2": "https://cdn.frankerfacez.com/b/2" } }] } };
  assert.equal(ffz({ default_sets: [3], sets }).get("ZrehplaR")!.url, "https://cdn.frankerfacez.com/a/1");
  assert.equal(ffz({ room: { set: 9 }, sets }).get("R")!.url, "https://cdn.frankerfacez.com/b/2");
  assert.equal(ffz({}).size, 0);
});
