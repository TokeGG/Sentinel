import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hostOf, isWebUrl, normalizeInput, searchUrl } from "./url.ts";
import { parseOperaBookmarks } from "./opera.ts";
import { emptyTabs, persistable, restoreTabs, tabsReducer, type TabState } from "./tabs.ts";
import { BROWSER_LEFT, BROWSER_TOP, DEFAULT_APPS } from "./layout.ts";

test("address bar: urls, bare hosts, searches", () => {
  assert.equal(normalizeInput("https://example.com/a b"), "https://example.com/a%20b");
  assert.equal(normalizeInput("example.com"), "https://example.com/");
  assert.equal(normalizeInput("sub.example.co.uk/path?q=1"), "https://sub.example.co.uk/path?q=1");
  assert.equal(normalizeInput("localhost:3000"), "http://localhost:3000/");
  assert.equal(normalizeInput("192.168.1.1"), "http://192.168.1.1/");
  assert.equal(normalizeInput("how to cook rice"), searchUrl("how to cook rice"));
  assert.equal(normalizeInput("rust", "google"), "https://www.google.com/search?q=rust");
  for (const bad of ["javascript:alert(1)", "file:///c:/x", "data:text/html,hi", "about:blank"]) assert.ok(normalizeInput(bad).startsWith("https://duckduckgo.com/?q="), bad);
  assert.equal(normalizeInput("   "), "");
  assert.equal(hostOf("https://www.twitch.tv/x"), "twitch.tv");
  assert.ok(isWebUrl("http://a.b/") && !isWebUrl("ftp://a.b/") && !isWebUrl(3));
});

test("Opera bookmarks fixture parses folders, bar flag, skips non-http", () => {
  const b = parseOperaBookmarks(readFileSync(new URL("./fixtures/opera-bookmarks.json", import.meta.url), "utf8"));
  assert.deepEqual(b, [
    { title: "Sentinel", url: "https://github.com/TokeGG/Sentinel", folder: "", bar: true },
    { title: "MDN", url: "https://developer.mozilla.org/", folder: "Dev", bar: true },
    { title: "http://example.com/", url: "http://example.com/", folder: "Other", bar: false },
  ]);
  assert.deepEqual(parseOperaBookmarks("not json"), []);
});

test("tab reducer: open next to active, close picks neighbour, nav/title, private never persisted", () => {
  let s: TabState = emptyTabs();
  s = tabsReducer(s, { type: "open", url: "https://a/" });
  s = tabsReducer(s, { type: "open", url: "https://b/" });
  s = tabsReducer(s, { type: "activate", id: 1 });
  s = tabsReducer(s, { type: "open", url: "https://c/", private: true });
  assert.deepEqual(s.tabs.map((t) => t.id), [1, 3, 2]);
  assert.equal(s.active, 3);
  s = tabsReducer(s, { type: "open", url: "https://d/", background: true });
  assert.equal(s.active, 3);
  s = tabsReducer(s, { type: "nav", id: 2, url: "https://b2/" });
  s = tabsReducer(s, { type: "title", id: 2, title: "B" });
  assert.equal(s.tabs.find((t) => t.id === 2)!.url, "https://b2/");
  s = tabsReducer(s, { type: "close", id: 3 });
  assert.equal(s.active, 4);
  const p = persistable(tabsReducer(s, { type: "open", url: "https://p/", private: true }));
  assert.ok(p.tabs.every((t) => !t.private));
  const r = restoreTabs(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(r.tabs.map((t) => t.id), p.tabs.map((t) => t.id));
  assert.ok(r.next > Math.max(...r.tabs.map((t) => t.id)));
  assert.deepEqual(restoreTabs({ tabs: [{ id: 1, url: "javascript:x" }] }).tabs, []);
  s = tabsReducer(s, { type: "move", id: 1, to: 99 });
  assert.equal(s.tabs[s.tabs.length - 1].id, 1);
});

test("toolbar sizes match geometry.rs; default sidebar apps are https", () => {
  const rs = readFileSync(new URL("../../../src-tauri/src/panels/geometry.rs", import.meta.url), "utf8");
  assert.equal(Number(/BROWSER_TOP: f64 = (\d+)/.exec(rs)![1]), BROWSER_TOP);
  assert.equal(Number(/BROWSER_LEFT: f64 = (\d+)/.exec(rs)![1]), BROWSER_LEFT);
  assert.equal(DEFAULT_APPS.length, 8);
  assert.ok(DEFAULT_APPS.every((a) => a.url.startsWith("https://")));
});
