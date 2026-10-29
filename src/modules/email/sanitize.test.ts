import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSrcdoc, sanitizeHtml, webUrl } from "./sanitize.ts";

const s = (h: string, loadImages = false) => sanitizeHtml(h, { loadImages });

test("drops scripts, styles and their content", () => {
  const c = s('<p>hi</p><script>alert(1)</script><style>p{background:url(http://x/y)}</style><p>bye</p>');
  assert.equal(c.html, "<p>hi</p><p>bye</p>");
});
test("unclosed script swallows the rest", () => {
  assert.equal(s("a<script>evil()").html, "a");
});
test("strips event handlers, style, class and unknown attributes", () => {
  const c = s('<div onclick="x()" style="background:url(http://e)" class="a" id="b" data-x="1">t</div>');
  assert.equal(c.html, "<div>t</div>");
});
test("removes iframe/object/embed/svg/form/link/meta/base", () => {
  const c = s('<iframe src="http://e"></iframe><object data="x"></object><embed src="x"><svg onload="x()"><circle/></svg><form action="http://e"><input name=p></form><link rel=stylesheet href="http://e"><meta http-equiv=refresh content="0;url=http://e"><base href="http://e">ok');
  assert.equal(c.html, "ok");
  assert.doesNotMatch(c.html, /iframe|object|embed|svg|form|input|link|meta|base/i);
});
test("links lose href; urls collected, only http(s)", () => {
  const c = s('<a href="https://ex.com/a?x=1&amp;y=2" onclick="x()">go</a><a href="javascript:alert(1)">bad</a><a href="jav&#x61;script:alert(1)">bad2</a><a href=" data:text/html,x">bad3</a>');
  assert.doesNotMatch(c.html, /href/i);
  assert.deepEqual(c.links, [{ text: "go", url: "https://ex.com/a?x=1&y=2" }]);
});
test("remote images blocked by default and counted", () => {
  const c = s('<img src="https://t.example/pixel.gif" width=1 height=1><img src="http://t.example/a.png">');
  assert.equal(c.html, "");
  assert.equal(c.blockedImages, 2);
});
test("remote images kept when loadImages is on, still escaped", () => {
  const c = s('<img src="https://ex.com/a.png?x=1&amp;y=&quot;onerror=x" alt="a&quot;b" onerror="x()">', true);
  assert.equal(c.html, '<img src="https://ex.com/a.png?x=1&amp;y=&quot;onerror=x" alt="a&quot;b">');
  assert.equal(c.blockedImages, 0);
});
test("data:image allowed, svg/cid/javascript images dropped even with loadImages", () => {
  assert.match(s('<img src="data:image/png;base64,AAAA">').html, /^<img src="data:image\/png;base64,AAAA"/);
  for (const src of ["data:image/svg+xml;base64,AAAA", "cid:logo", "javascript:alert(1)", "file:///c:/x.png", "//evil.com/x.png", "x.png"]) {
    assert.equal(s(`<img src="${src}">`, true).html, "", src);
  }
});
test("comments and conditional comments removed", () => {
  assert.equal(s("a<!-- <script>x</script> -->b<!--[if mso]><p>x</p><![endif]-->c").html, "abc");
});
test("broken/nested tag tricks do not produce tags", () => {
  const c = s("<scr<script>ipt>alert(1)</scr</script>ipt>");
  assert.doesNotMatch(c.html, /<script|<scr/i);
  assert.doesNotMatch(s("<<img src=x onerror=alert(1)//>").html, /onerror/i);
});
test("text is escaped; entity-encoded markup stays text", () => {
  assert.equal(s("1 < 2 &amp; &lt;script&gt;").html, "1 &lt; 2 &amp; &lt;script&gt;");
});
test("td colspan numeric only; table structure kept", () => {
  assert.equal(s('<table><tr><td colspan="2" style="x">a</td><td colspan="x">b</td></tr></table>').html, '<table><tr><td colspan="2">a</td><td>b</td></tr></table>');
});
test("unclosed anchor is closed", () => {
  assert.equal(s('<a href="https://e.com">x').html, "<a>x</a>");
});
test("webUrl", () => {
  assert.equal(webUrl("https://a.b/c"), "https://a.b/c");
  assert.equal(webUrl("mailto:a@b.c"), null);
  assert.equal(webUrl("javascript:alert(1)"), null);
});
test("srcdoc has a CSP that blocks scripts and remote content by default", () => {
  const d = buildSrcdoc("<p>x</p>", false);
  assert.match(d, /default-src 'none'; img-src data:;/);
  assert.doesNotMatch(d, /script-src/);
  assert.match(buildSrcdoc("", true), /img-src data: https:/);
});
