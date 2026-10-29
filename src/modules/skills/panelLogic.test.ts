import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bundleLabel, groupByBundle, skillsSections, type Item } from "./panelLogic.ts";
import { isLocalUrl, OLLAMA_TAGS_URL, parseTags } from "./localModel.ts";

const it_ = (name: string, bundle: string): Item => ({ id: "skill:" + name, kind: "skill", key: name, name, description: "", bundle, enabled: true, source: "bundled", repo: "", sha: "", detail: "", secrets: [] });

describe("skills panelLogic", () => {
  it("groups by bundle with General last and names sorted", () => {
    const g = groupByBundle([it_("z", ""), it_("b", "hub.news"), it_("a", "hub.deals"), it_("a2", "hub.news")]);
    assert.deepEqual(g.map((x) => x.label), ["Deals", "News", "General"]);
    assert.deepEqual(g[1].items.map((x) => x.name), ["a2", "b"]);
    assert.equal(bundleLabel(""), "General");
  });
  it("section ids are declared and match Panel.tsx", () => {
    assert.deepEqual(skillsSections.map((s) => s.id), ["skills", "servers", "install", "model"]);
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, skillsSections.map((s) => s.id).sort());
  });
});

describe("local model", () => {
  it("only loopback URLs count as local", () => {
    assert.ok(isLocalUrl(OLLAMA_TAGS_URL) && isLocalUrl("http://localhost:11434/x"));
    for (const bad of ["http://192.168.1.2:11434", "https://ollama.com/api/tags", "http://127.0.0.1.evil.com/", "ftp://127.0.0.1", "nope"]) assert.ok(!isLocalUrl(bad), bad);
  });
  it("parseTags keeps named models, sorted", () => {
    assert.deepEqual(parseTags({ models: [{ name: "b:7b", size: 5 }, { name: "a", size: "x" }, { size: 1 }, null, { name: "" }] }), [{ name: "a", size: 0 }, { name: "b:7b", size: 5 }]);
    assert.deepEqual(parseTags(null), []);
    assert.deepEqual(parseTags({ models: "x" }), []);
  });
});
