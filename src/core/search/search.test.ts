import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fuzzyScore, rank } from "./fuzzy.ts";
import { rowsToHits, rowTitle } from "./rowHits.ts";
import { searchAll, type Provider } from "./registry.ts";

describe("fuzzyScore", () => {
  it("matches subsequences and rejects misses", () => {
    assert.ok(fuzzyScore("nts", "Notes") !== null);
    assert.equal(fuzzyScore("xyz", "Notes"), null);
    assert.equal(fuzzyScore("", "anything"), 0);
  });
  it("prefers exact prefix over scattered", () => {
    assert.ok(fuzzyScore("fin", "Finance")! > fuzzyScore("fin", "Pentest Lab info")!);
    assert.ok(fuzzyScore("gm", "Game mode")! > fuzzyScore("gm", "Programming")!);
  });
  it("rank orders and limits", () => {
    assert.deepEqual(rank(["Weather", "News", "Network"], "ne", (s) => s, 2), ["News", "Network"]);
  });
});

describe("rowsToHits", () => {
  it("picks a title field and first line only", () => {
    assert.equal(rowTitle({ body: "line one\nsecret two" }), "line one");
    assert.equal(rowTitle({ title: "T", body: "b" }), "T");
    assert.deepEqual(rowsToHits([{ id: 3, name: "repo", source: "gh" }, { x: 1 }]), [{ title: "repo", subtitle: "gh", id: "3" }]);
  });
});

describe("searchAll", () => {
  it("merges providers, skips failures, dedupes keys", async () => {
    const run = () => {};
    const ps: Provider[] = [
      { id: "a", label: "A", search: () => [{ key: "p:notes", title: "Notes", kind: "panel", run }] },
      { id: "b", label: "B", search: async () => { throw new Error("x"); } },
      { id: "c", label: "C", search: () => [{ key: "p:notes", title: "Notes", kind: "panel", run }, { key: "c:1", title: "note about cats", kind: "content", run }] },
    ];
    const errs: string[] = [];
    const hits = await searchAll("note", 10, (id) => errs.push(id), ps);
    assert.deepEqual(hits.map((h) => h.key), ["p:notes", "c:1"]);
    assert.deepEqual(errs, ["b"]);
  });
});
