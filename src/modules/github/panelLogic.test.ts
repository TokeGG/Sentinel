import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activeTab, githubSections, isCloned, languageColor, repoView, rowsForTab, shortText, skillForTab, starsText,
} from "./panelLogic.ts";

describe("github panelLogic", () => {
  it("starsText formats with k / M", () => {
    assert.equal(starsText(999), "999");
    assert.equal(starsText(0), "0");
    assert.equal(starsText(1000), "1k");
    assert.equal(starsText(1234), "1.2k");
    assert.equal(starsText(98150), "98.2k");
    assert.equal(starsText(999_950), "1M");
    assert.equal(starsText(1_200_000), "1.2M");
    assert.equal(starsText(null), "0");
    assert.equal(starsText(NaN), "0");
    assert.equal(starsText(-5), "0");
  });
  it("languageColor: known, case-insensitive, stable fallback, null-safe", () => {
    assert.equal(languageColor("TypeScript"), "#3178c6");
    assert.equal(languageColor("rust"), languageColor("Rust"));
    const a = languageColor("Brainfuck");
    assert.match(String(a), /^hsl\(\d{1,3} \d+% \d+%\)$/);
    assert.equal(languageColor("Brainfuck"), a);
    assert.notEqual(languageColor("Brainfuck"), languageColor("Haskellish"));
    assert.equal(languageColor(null), null);
    assert.equal(languageColor(undefined), null);
    assert.equal(languageColor("  "), null);
  });
  it("isCloned only for an explicit true", () => {
    assert.equal(isCloned({ cloned: true }), true);
    assert.equal(isCloned({ cloned: false }), false);
    assert.equal(isCloned({}), false);
    assert.equal(isCloned({ cloned: "yes" }), false);
  });
  it("shortText truncates with an ellipsis and tolerates null", () => {
    assert.equal(shortText("abc", 10), "abc");
    assert.equal(shortText("a".repeat(20), 10), "a".repeat(9) + "…");
    assert.equal(shortText(null, 10), "");
    assert.equal(shortText("  hi \n there ", 20), "hi there");
  });
  it("repoView derives fields, also from sparse rows", () => {
    const v = repoView({
      id: "o/r", name: "o/r", stars: 1500, language: "Go", description: "d", link: "https://github.com/o/r", cloned: true,
    });
    assert.deepEqual(
      [v.name, v.stars, v.language, v.color, v.description, v.link, v.cloned],
      ["o/r", "1.5k", "Go", "#00add8", "d", "https://github.com/o/r", true]
    );
    const s = repoView({ id: "x/y", title: "x/y ★42", link: "javascript:alert(1)" });
    assert.equal(s.name, "x/y");
    assert.equal(s.stars, "42");
    assert.equal(s.language, null);
    assert.equal(s.color, null);
    assert.equal(s.link, null);
  });
  it("tabs: active tab follows loaded rows unless chosen; rows filter by source", () => {
    const rows = [{ id: 1, source: "starred" }, { id: 2, source: "starred" }];
    assert.equal(activeTab(null, rows), "starred");
    assert.equal(activeTab("trending", rows), "trending");
    assert.equal(activeTab(null, []), "trending");
    assert.equal(rowsForTab(rows, "starred").length, 2);
    assert.equal(rowsForTab(rows, "trending").length, 0);
    assert.equal(rowsForTab([{ id: 3 }], "trending").length, 1); // no source -> shown
    assert.equal(skillForTab("starred"), "fetch_starred");
    assert.equal(skillForTab("trending"), "fetch_trending");
  });
  it("section ids", () => {
    assert.deepEqual(githubSections.map((s) => s.id), ["credentials", "tabs", "repos", "cloned", "actions"]);
  });
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, githubSections.map((s) => s.id).sort());
  });
});
