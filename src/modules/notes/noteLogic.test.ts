import { test } from "node:test";
import assert from "node:assert/strict";
import { backlinks, folderTree, listNotes, noteTitle, parseTags, resolveLink, tagCounts, wikiLinks, type NoteRow } from "./noteLogic.ts";
import { highlight, searchNotes, snippetAround } from "./noteSearch.ts";
import { dailyBody, dayTitle, findDaily, onThisDay, promptFor } from "./journal.ts";
import { allMarkdown, noteMarkdown, safeFileName } from "./exportMd.ts";

const n = (id: number, body: string, o: Partial<NoteRow> = {}): NoteRow => ({ id, body, tags: null, filed_to: null, created_at: "2026-01-01 10:00:00", ...o });

test("title/tags/links", () => {
  assert.equal(noteTitle("\n## Hello [[x]]\nbody"), "Hello x");
  assert.equal(noteTitle("   "), "Untitled");
  assert.equal(noteTitle("a".repeat(100)).length, 60);
  assert.deepEqual(parseTags("#Work, work  ideas"), ["work", "ideas"]);
  assert.deepEqual(wikiLinks("a [[B]] and [[B]] and [[ C ]]"), ["B", "C"]);
});
test("backlinks match by title, case-insensitive, not self", () => {
  const ns = [n(1, "# Alpha\nsee [[beta]]"), n(2, "# Beta\n[[Alpha]]"), n(3, "# Gamma\n[[Beta]] [[gamma]]")];
  assert.deepEqual(backlinks(ns, 2).map((x) => x.id), [1, 3]);
  assert.deepEqual(backlinks(ns, 3).map((x) => x.id), []);
  assert.equal(resolveLink(ns, "ALPHA")?.id, 1);
  assert.equal(resolveLink(ns, "nope"), null);
});
test("folder tree nests and counts", () => {
  const t = folderTree(["Work/A", "Work/B", "Work", "Home", ""]);
  assert.deepEqual(t.map((x) => [x.path, x.count]), [["Home", 1], ["Work", 3]]);
  assert.deepEqual(t[1].children.map((x) => x.path), ["Work/A", "Work/B"]);
});
test("listNotes: pinned first, archive hidden, folder prefix, tag", () => {
  const ns = [n(1, "a", { updated_at: "2026-02-01" }), n(2, "b", { pinned: 1, updated_at: "2026-01-01" }), n(3, "c", { archived: 1 }), n(4, "d", { folder: "W/X", tags: "t" })];
  assert.deepEqual(listNotes(ns).map((x) => x.id), [2, 1, 4]);
  assert.equal(listNotes(ns)[0].id, 2);
  assert.ok(!listNotes(ns).some((x) => x.id === 3));
  assert.deepEqual(listNotes(ns, { archived: true }).map((x) => x.id), [3]);
  assert.deepEqual(listNotes(ns, { folder: "W" }).map((x) => x.id), [4]);
  assert.deepEqual(listNotes(ns, { tag: "t" }).map((x) => x.id), [4]);
  assert.deepEqual(tagCounts(ns), [["t", 1]]);
});
test("search ranks title over body and requires every term", () => {
  const ns = [n(1, "x\nfoo bar baz"), n(2, "foo\nnothing"), n(3, "zzz")];
  assert.deepEqual(searchNotes(ns, "foo").map((h) => h.note.id), [2, 1]);
  assert.deepEqual(searchNotes(ns, "foo baz").map((h) => h.note.id), [1]);
  assert.deepEqual(searchNotes(ns, "  "), []);
});
test("highlight and snippet", () => {
  assert.deepEqual(highlight("A foo b FOO", "foo"), [{ text: "A ", hit: false }, { text: "foo", hit: true }, { text: " b ", hit: false }, { text: "FOO", hit: true }]);
  assert.deepEqual(highlight("a.b", "."), [{ text: "a", hit: false }, { text: ".", hit: true }, { text: "b", hit: false }]);
  assert.equal(highlight("x", "")[0].hit, false);
  assert.match(snippetAround("a".repeat(200) + "needle" + "b".repeat(200), "needle"), /^…a+needleb+…$/);
});
test("journal: titles, prompts, on this day", () => {
  const d = new Date(2026, 9, 29);
  assert.equal(dayTitle(d), "2026-10-29");
  assert.ok(promptFor(d).length > 5);
  assert.match(dailyBody(d), /^# 2026-10-29\n\n> /);
  const ns = [n(1, "# 2025-10-29\nx"), n(2, "# 2026-10-29"), n(3, "# 2024-10-29"), n(4, "# 2025-10-30")];
  assert.deepEqual(onThisDay(ns, d).map((x) => x.id), [1, 3]);
  assert.equal(findDaily(ns, d)?.id, 2);
});
test("export", () => {
  const md = noteMarkdown(n(1, "# T\nbody", { tags: "a b", folder: "F" }));
  assert.match(md, /^---\ncreated: .*\nfolder: F\ntags: \[a, b\]\n---\n\n# T\nbody\n$/);
  assert.equal(allMarkdown([n(1, "a"), n(2, "b")]).split("---\ncreated").length, 3);
  assert.equal(safeFileName('a/b:c?'), "abc.md");
  assert.equal(safeFileName("///"), "note.md");
});
