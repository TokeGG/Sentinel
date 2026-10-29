import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filesearchSections, folderOf, nameOf, rootsOf, resultsOf, shortPath, shouldSearch } from "./panelLogic.ts";

describe("filesearch panelLogic", () => {
  it("shouldSearch needs 2+ non-space characters", () => {
    assert.equal(shouldSearch(""), false);
    assert.equal(shouldSearch(" a "), false);
    assert.equal(shouldSearch("ab"), true);
    assert.equal(shouldSearch("  ab "), true);
    assert.equal(shouldSearch(undefined as unknown as string), false);
  });
  it("nameOf/folderOf split Windows, POSIX and UNC paths", () => {
    assert.equal(nameOf("C:\\a\\b\\f.txt"), "f.txt");
    assert.equal(folderOf("C:\\a\\b\\f.txt"), "C:\\a\\b");
    assert.equal(nameOf("/a/b/f.txt"), "f.txt");
    assert.equal(folderOf("/a/b/f.txt"), "/a/b");
    assert.equal(folderOf("\\\\srv\\share\\f.txt"), "\\\\srv\\share");
    assert.equal(folderOf("f.txt"), "");
  });
  it("shortPath returns short paths untouched", () => {
    assert.equal(shortPath("C:\\a\\f.txt", 40), "C:\\a\\f.txt");
    assert.equal(shortPath("", 10), "");
  });
  it("shortPath keeps drive and file name with a middle ellipsis", () => {
    assert.equal(shortPath("C:\\Users\\me\\Documents\\Projects\\report.docx", 30), "C:\\…\\report.docx");
    assert.equal(shortPath("/home/me/projects/deep/notes.md", 20), "/…/notes.md");
  });
  it("shortPath handles UNC roots", () => {
    assert.equal(shortPath("\\\\server\\share\\a\\b\\c\\file.txt", 26), "\\\\server\\share\\…\\file.txt");
  });
  it("shortPath shortens a very long file name to fit and never exceeds max", () => {
    const p = "C:\\a\\b\\" + "n".repeat(80) + ".txt";
    const s = shortPath(p, 30);
    assert.ok(s.length <= 30, s);
    assert.ok(s.startsWith("C:\\"));
    assert.ok(s.endsWith(".txt"));
    assert.ok(shortPath("C:\\a\\b\\c\\d.txt", 3).length <= 3);
  });
  it("rootsOf/resultsOf pick rows by kind", () => {
    const rows = [{ id: "root-0", kind: "root", path: "C:\\x" }, { id: 0, kind: "result", path: "C:\\x\\a.txt" }, { id: 1, path: "" }];
    assert.deepEqual(rootsOf(rows), ["C:\\x"]);
    assert.deepEqual(resultsOf(rows).map((r) => r.path), ["C:\\x\\a.txt"]);
  });
  it("section ids are declared and match Panel.tsx", () => {
    assert.deepEqual(filesearchSections.map((s) => s.id), ["search", "roots", "results"]);
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, filesearchSections.map((s) => s.id).sort());
  });
});
