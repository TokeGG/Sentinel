import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clipboardSections, dedupeConsecutive, glyphFor, kindFor, pinFirst, previewText, splitRows } from "./panelLogic.ts";

describe("clipboard panelLogic", () => {
  it("previewText is single line, collapsed and ellipsised", () => {
    assert.equal(previewText("a\n\n  b\t c", 50), "a b c");
    assert.equal(previewText("   ", 10), "");
    assert.equal(previewText("", 10), "");
    assert.equal(previewText("abcdefghij", 10), "abcdefghij");
    assert.equal(previewText("abcdefghijk", 10), "abcdefghi…");
    assert.equal(previewText("x".repeat(100000), 20).length, 20);
    assert.equal(previewText("abc", 0), "");
    assert.equal(previewText(undefined as unknown as string, 5), "");
  });
  it("kindFor/glyphFor go by extension, with a fallback", () => {
    assert.equal(kindFor("C:\\Apps\\tool.EXE"), "app");
    assert.equal(kindFor("C:\\Users\\me\\Docs"), "folder");
    assert.equal(kindFor("D:\\x\\"), "folder");
    assert.equal(kindFor("C:\\a\\notes.txt"), "file");
    assert.equal(kindFor(""), "file");
    assert.equal(glyphFor("a.exe"), glyphFor("b.lnk"));
    assert.notEqual(glyphFor("a.exe"), glyphFor("a.txt"));
    assert.notEqual(glyphFor("a.txt"), glyphFor("C:\\dir"));
    assert.ok(glyphFor("???").length > 0);
  });
  it("splitRows separates launchers from clips by id prefix", () => {
    const s = splitRows([
      { id: "launch-1", title: "▶ Calc", path: "C:\\calc.exe" },
      { id: "launch-2", title: "▶ Docs", label: "Docs", path: "C:\\Docs" },
      { id: "clip-9", title: "hello", copied_at: "2026-10-28 10:00:00" },
      { id: "weird", title: "?" },
    ]);
    assert.deepEqual(s.launch.map((l) => [l.label, l.path]), [["Calc", "C:\\calc.exe"], ["Docs", "C:\\Docs"]]);
    assert.equal(s.clips.length, 1);
    assert.equal(s.clips[0].text, "hello");
  });
  it("dedupeConsecutive drops only adjacent repeats", () => {
    const c = (t: string) => ({ id: t + Math.random(), text: t, copiedAt: "" });
    assert.deepEqual(dedupeConsecutive([c("a"), c("a"), c("b"), c("a")]).map((x) => x.text), ["a", "b", "a"]);
    assert.deepEqual(dedupeConsecutive([]), []);
  });
  it("section ids are declared and match Panel.tsx", () => {
    assert.deepEqual(clipboardSections.map((s) => s.id), ["launcher", "history", "status"]);
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, clipboardSections.map((s) => s.id).sort());
  });
  it("pinFirst moves pinned clips up and keeps the rest in order", () => {
    const c = ["a", "b", "c", "d"].map((id) => ({ id }));
    assert.deepEqual(pinFirst(c, new Set(["c", "b"])).map((x) => x.id), ["b", "c", "a", "d"]);
    assert.deepEqual(pinFirst(c, new Set()).map((x) => x.id), ["a", "b", "c", "d"]);
  });
});
