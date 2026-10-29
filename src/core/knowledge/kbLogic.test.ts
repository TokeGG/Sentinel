import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleFromAnswer, insertEntry, lessonFromBadAnswer, makeEntry, readEntries, retrieveKb, type KbEntry } from "./kbLogic.ts";

test("makeEntry validates category, kind and body", () => {
  assert.equal(makeEntry("x", "note", "t", "b").ok, false);
  assert.equal(makeEntry("news", "bogus", "t", "b").ok, false);
  assert.equal(makeEntry("news", "note", "t", "  ").ok, false);
  const r = makeEntry("news", "note", "", "Body text here");
  assert.ok(r.ok && r.entry.title === "Body text here");
});

test("thumbs up/down become example / qa entries", () => {
  const up = exampleFromAnswer("finance", "What moved?", "AAPL up 2% [r1]");
  assert.ok(up.ok && up.entry.kind === "example" && /Q: What moved\?\nA: AAPL/.test(up.entry.body));
  const down = lessonFromBadAnswer("finance", "What moved?", "no idea");
  assert.ok(down.ok && down.entry.kind === "qa" && /do not repeat/.test(down.entry.body));
});

test("SQL builder + readEntries drops malformed rows", () => {
  const e: KbEntry = { category: "lab", kind: "note", title: "t", body: "b" };
  assert.deepEqual(insertEntry(e).params, ["lab", "note", "t", "b"]);
  const rows = readEntries([{ id: 1, category: "lab", kind: "note", title: "a", body: "b" }, { id: 2, category: "zz", kind: "note", title: "a", body: "b" }, null]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 1);
});

test("retrieveKb ranks by BM25", () => {
  const es: KbEntry[] = [
    { id: 1, category: "deals", kind: "note", title: "Steam sales", body: "Steam seasonal sales start in late June and December." },
    { id: 2, category: "deals", kind: "note", title: "Shipping", body: "Free shipping over 50 euro at most stores." },
  ];
  const s = retrieveKb(es, "when is the next steam sale", 2);
  assert.equal(s[0].noteId, 1);
});
