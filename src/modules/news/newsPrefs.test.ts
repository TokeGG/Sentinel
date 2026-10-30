import { it } from "node:test";
import assert from "node:assert/strict";
import { alertHits, dueSources, hostOf, readerDoc, readNumMap, withoutBlocked } from "./newsPrefsLogic.ts";

it("hostOf strips www and survives junk", () => {
  assert.equal(hostOf("https://www.BBC.co.uk/x"), "bbc.co.uk");
  assert.equal(hostOf("nope"), "");
});
it("blocks hosts and subdomains by link or source url", () => {
  const rows = [{ id: 1, link: "https://feeds.bbc.co.uk/a" }, { id: 2, link: "https://x.com/a", source_url: "https://kotaku.com/rss" }, { id: 3, link: "https://ok.org" }];
  assert.deepEqual(withoutBlocked(rows, ["bbc.co.uk", "https://kotaku.com"]).map((r) => r.id), [3]);
  assert.equal(withoutBlocked(rows, []).length, 3);
});
it("counts alert hits newer than the seen id", () => {
  const rows = [{ id: 5, title: "CS2 Major final" }, { id: 2, title: "major news" }, { id: 7, title: "other" }];
  assert.deepEqual(alertHits(rows, ["major"], 3).map((r) => r.id), [5]);
  assert.equal(alertHits(rows, []).length, 0);
});
it("reads number maps safely", () => {
  assert.deepEqual(readNumMap('{"a":5,"b":"x","c":-1}'), { a: 5 });
  assert.deepEqual(readNumMap("bad"), {});
});
it("only due sources are fetched by auto-refresh", () => {
  const s = [{ url: "a" }, { url: "b" }, { url: "c" }];
  const due = dueSources(s, { a: 60, b: 60 }, { a: 0, b: 1_000_000 }, 1_000_000 + 30 * 60000);
  assert.deepEqual(due.map((x) => x.url), ["a", "c"]);
});
it("reader doc keeps the article and drops scripts", () => {
  const d = readerDoc('<html><body><nav>menu</nav><article><p>Hi</p><script>bad()</script></article></body></html>', "T<1>", 16, 70);
  assert.ok(d.includes("<p>Hi</p>"));
  assert.ok(!d.includes("script") && !d.includes("menu"));
  assert.ok(d.includes("T&lt;1&gt;") && d.includes("max-width:70ch"));
});
