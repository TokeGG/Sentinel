import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { featureLabel, itemFeatures, tokens } from "./features.ts";
import { EPSILON, FADE, MAX_FEATURES, STEP_CAP, applySignal, emptyProfile, forgetFeature, rank, score, topFeatures, why, type Profile } from "./model.ts";
import { orderItems } from "./order.ts";
import { mulberry32 } from "./rng.ts";

const item = (key: string, features: string[]) => ({ key, features });
const learn = (p: Profile, f: string[], s: Parameters<typeof applySignal>[2], n = 1) => { for (let i = 0; i < n; i++) p = applySignal(p, f, s); return p; };

describe("features", () => {
  it("tokens drop stopwords, numbers, short words, plurals; unique", () => {
    assert.deepEqual(tokens("The RTX 4070 GPUs and the GPU deal 2024"), ["rtx", "gpu"]);
  });
  it("itemFeatures prefixes and dedupes", () => {
    const f = itemFeatures({ source: "Slick Deals", category: "pc", text: "SSD SSD drive", extra: ["tag:gpu"] });
    assert.deepEqual(f, ["src:slick-deals", "cat:pc", "kw:ssd", "kw:drive", "tag:gpu"]);
    assert.equal(featureLabel("kw:ssd"), "keyword “ssd”");
  });
});

describe("model signals", () => {
  it("like raises, dislike lowers, open is weaker than like", () => {
    const f = ["src:a"];
    const like = score(item("x", f), learn(emptyProfile(), f, "like"));
    const open = score(item("x", f), learn(emptyProfile(), f, "open"));
    const dis = score(item("x", f), learn(emptyProfile(), f, "dislike"));
    assert.ok(like > open && open > 0 && dis < 0);
    assert.ok(score(item("x", f), learn(emptyProfile(), f, "dismiss")) > dis); // -0.7 < -1 in strength
    assert.ok(score(item("x", f), learn(emptyProfile(), f, "finish")) > open);
  });
  it("one update is capped by STEP_CAP", () => {
    const p = learn(emptyProfile(), ["src:a"], "like");
    assert.ok(p.f["src:a"].v <= STEP_CAP + 1e-9);
    const p2 = learn(p, ["src:a"], "like");
    assert.ok(p2.f["src:a"].v - p.f["src:a"].v <= STEP_CAP + 1e-9);
  });
  it("scores stay bounded and opposite evidence pulls back", () => {
    const f = ["src:a", "kw:x"];
    let p = learn(emptyProfile(), f, "like", 50);
    assert.ok(score(item("i", f), p) < 1);
    const before = score(item("i", f), p);
    p = learn(p, f, "dislike", 3);
    assert.ok(score(item("i", f), p) < before);
  });
  it("old evidence fades when new evidence for the feature arrives", () => {
    const p1 = learn(emptyProfile(), ["src:a"], "like");
    const p2 = applySignal(p1, ["src:a"], "like");
    assert.ok(p2.f["src:a"].n < p1.f["src:a"].n * FADE + 1 + 1e-9);
    assert.equal(p2.f["src:b"], undefined);
  });
  it("feature count is bounded", () => {
    const many = Array.from({ length: MAX_FEATURES + 50 }, (_, i) => `kw:w${i}`);
    assert.equal(Object.keys(learn(emptyProfile(), many, "like").f).length, MAX_FEATURES);
  });
  it("forget removes a feature; topFeatures splits liked/disliked", () => {
    let p = learn(emptyProfile(), ["src:good"], "like", 3);
    p = learn(p, ["src:bad"], "dislike", 3);
    assert.equal(topFeatures(p, 1)[0].feature, "src:good");
    assert.equal(topFeatures(p, -1)[0].feature, "src:bad");
    assert.equal(forgetFeature(p, "src:good").f["src:good"], undefined);
  });
});

describe("rank / why / exploration", () => {
  const p = learn(learn(emptyProfile(), ["src:a", "kw:ssd"], "like", 3), ["src:b"], "dislike", 3);
  const items = [item("b", ["src:b"]), item("n", ["src:new"]), item("a", ["src:a", "kw:ssd"])];
  it("why lists top 3 by strength", () => {
    const w = why(item("a", ["src:a", "kw:ssd", "kw:zzz", "cat:q"]), p);
    assert.equal(w.length, 2);
    assert.equal(w[0].feature, "src:a");
    assert.ok(w.every((x) => x.contrib > 0));
  });
  it("liked first, disliked last (no exploration)", () => {
    assert.deepEqual(rank(items, p, () => 1).map((r) => r.item.key), ["a", "n", "b"]);
  });
  it("is deterministic for the same rng and surfaces unseen items when rng is low", () => {
    const run = (seed: number) => rank(items, p, mulberry32(seed)).map((r) => r.item.key).join();
    assert.equal(run(7), run(7));
    const boosted = rank(items, p, () => 0);
    assert.ok(boosted.find((r) => r.item.key === "n")!.explored);
    assert.equal(boosted[0].item.key, "a" === boosted[0].item.key ? "a" : "n");
    assert.ok(EPSILON < 0.5);
  });
  it("empty profile keeps input order and never explores", () => {
    const r = rank(items, emptyProfile(), () => 0);
    assert.deepEqual(r.map((x) => x.item.key), ["b", "n", "a"]);
    assert.ok(r.every((x) => !x.explored));
  });
  it("orderItems hides dismissed, keeps order when For-you is off", () => {
    const toItem = (r: { k: string; f: string[] }) => item(r.k, r.f);
    const rows = items.map((i) => ({ k: i.key, f: i.features }));
    const base = { forYou: false, off: false, rng: () => 1 };
    assert.deepEqual(orderItems(rows, toItem, p, { n: "hide" }, base).map((x) => x.item.k), ["b", "a"]);
    assert.deepEqual(orderItems(rows, toItem, p, {}, { ...base, forYou: true }).map((x) => x.item.k), ["a", "n", "b"]);
    assert.deepEqual(orderItems(rows, toItem, p, {}, { ...base, forYou: true, off: true }).map((x) => x.item.k), ["b", "n", "a"]);
  });
});

describe("rng", () => {
  it("mulberry32 is seeded and in [0,1)", () => {
    const a = mulberry32(1), b = mulberry32(1);
    for (let i = 0; i < 20; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
  });
});
