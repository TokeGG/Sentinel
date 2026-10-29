import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "./markdown.ts";

test("escapes raw html", () => {
  const h = renderMarkdown('<script>alert(1)</script> <img src=x onerror=y>');
  assert.ok(!h.includes("<script") && !h.includes("<img"));
  assert.match(h, /&lt;script&gt;/);
});
test("headings, emphasis, code", () => {
  assert.equal(renderMarkdown("# Hi"), "<h1>Hi</h1>");
  assert.equal(renderMarkdown("a **b** *c* `d*e*`"), "<p>a <strong>b</strong> <em>c</em> <code>d*e*</code></p>");
});
test("only http(s) links become anchors", () => {
  assert.match(renderMarkdown("[x](https://a.b/c)"), /<a href="https:\/\/a.b\/c"/);
  assert.ok(!renderMarkdown("[x](javascript:alert(1))").includes("<a "));
});
test("quotes in a link cannot break the attribute", () => {
  assert.ok(!/href="[^"]*"[^>]*onclick/.test(renderMarkdown('[x](https://a.b/"onclick=1)')));
});
test("wikilinks", () => assert.match(renderMarkdown("see [[My Note]]"), /<a class="wikilink" data-note="My Note">My Note<\/a>/));
test("wikilink name cannot inject attributes", () => assert.ok(!renderMarkdown('[[a" onclick="x]]').includes('" onclick="')));
test("lists, tasks, quotes, fences, hr", () => {
  assert.equal(renderMarkdown("- a\n- [x] b"), "<ul><li>a</li><li>☑ b</li></ul>");
  assert.equal(renderMarkdown("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
  assert.equal(renderMarkdown("> q"), "<blockquote>q</blockquote>");
  assert.equal(renderMarkdown("```\n<b>\n```"), "<pre><code>&lt;b&gt;</code></pre>");
  assert.equal(renderMarkdown("---"), "<hr>");
});
test("paragraph lines join with br; empty input is empty", () => {
  assert.equal(renderMarkdown("a\nb"), "<p>a<br>b</p>");
  assert.equal(renderMarkdown(""), "");
});
