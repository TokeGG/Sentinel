import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EMBED_TAB_H, FEED_TAB, SITE_PRESETS, allTabs, defaultTabs, hostsFor, isValidHost, isValidSlug, parseSiteUrl, parseTab, parseTabs, siteOf, slugify, tabsReducer } from "./embedSites.ts";

test("EMBED_TAB_H matches geometry.rs", () => {
  const rs = readFileSync(new URL("../../../src-tauri/src/panels/geometry.rs", import.meta.url), "utf8");
  assert.equal(Number(/EMBED_TAB_H: f64 = (\d+)/.exec(rs)![1]), EMBED_TAB_H);
});

test("presets are https, unique, start host allowed, hosts valid", () => {
  assert.equal(new Set(SITE_PRESETS.map((p) => p.key)).size, SITE_PRESETS.length);
  assert.equal(SITE_PRESETS.length, 20);
  for (const p of SITE_PRESETS) {
    const u = parseSiteUrl(p.url)!;
    assert.ok(u, p.key);
    assert.ok(isValidSlug(p.key), p.key);
    assert.ok(p.hosts.every(isValidHost), p.key);
    assert.ok(p.hosts.some((h) => h === u.hostname || (h.startsWith("*.") && u.hostname.endsWith(h.slice(1)))), p.key);
  }
});

test("defaults keep x/facebook/instagram ids and profiles (logins survive)", () => {
  assert.deepEqual(defaultTabs().map((t) => [t.id, t.profile]), [["x", "x"], ["facebook", "facebook"], ["instagram", "instagram"]]);
  assert.deepEqual(allTabs(defaultTabs()).map((t) => t.label), ["Feed", "Following & Likes", "X", "Facebook", "Instagram"]);
  assert.deepEqual(parseTabs(null), defaultTabs());
  assert.deepEqual(parseTabs("garbage"), defaultTabs());
  assert.deepEqual(parseTabs("[]"), []); // user deleted them all
});

test("slug + host validation mirrors Rust is_valid_site", () => {
  for (const ok of ["x", "my-site", "a1", "a".repeat(24)]) assert.ok(isValidSlug(ok), ok);
  for (const bad of ["", "-a", "a-", "A", "a_b", "a".repeat(25), "feed", "follows", "tab3"]) assert.ok(!isValidSlug(bad), bad);
  assert.equal(slugify("Telegram Web", []), "telegram-web");
  assert.equal(slugify("X", ["x"]), "x-2");
  assert.equal(slugify("Feed", []), "feed-2");
  assert.equal(slugify("!!!", []), "site");
  assert.equal(slugify("Tab 3", []), "tab-3");
  assert.ok(isValidHost("*.x.com") && !isValidHost("x") && !isValidHost("1.2.3.4") && !isValidHost("a..b"));
  for (const bad of ["http://x.com", "https://u:p@x.com", "https://x.com:8443", "javascript:alert(1)", "https://localhost"]) assert.equal(parseSiteUrl(bad), null, bad);
  assert.deepEqual(hostsFor(new URL("https://www.foo.org/a")), ["foo.org", "*.foo.org"]);
});

test("reducer: add preset / custom / mastodon instance", () => {
  let t = tabsReducer(defaultTabs(), { type: "add", name: "Threads", url: "https://www.threads.net", preset: "threads" });
  assert.deepEqual(t.slice(-1)[0].id, "threads");
  assert.equal(t.slice(-1)[0].profile, "social-threads");
  t = tabsReducer(t, { type: "add", name: "Fosstodon", url: "https://fosstodon.org/home", preset: "mastodon" });
  assert.ok(t.slice(-1)[0].hosts.includes("fosstodon.org") && t.slice(-1)[0].hosts.includes("*.fosstodon.org"));
  t = tabsReducer(t, { type: "add", name: "X", url: "https://example.com" });
  assert.equal(t.slice(-1)[0].id, "x-2");
  assert.deepEqual(t.slice(-1)[0].hosts, ["example.com", "*.example.com"]);
  const same = tabsReducer(t, { type: "add", name: "Bad", url: "http://example.com" });
  assert.equal(same, t);
  assert.equal(tabsReducer(t, { type: "add", name: "  ", url: "https://a.com" }), t);
  assert.deepEqual(parseTabs(JSON.stringify(t)), t);
});

test("reducer: remove, rename, move; invalid returns same array", () => {
  const d = defaultTabs();
  assert.deepEqual(tabsReducer(d, { type: "remove", id: "facebook" }).map((t) => t.id), ["x", "instagram"]);
  assert.equal(tabsReducer(d, { type: "remove", id: "feed" }), d);
  assert.equal(tabsReducer(d, { type: "rename", id: "x", label: "Twitter" })[0].label, "Twitter");
  assert.equal(tabsReducer(d, { type: "rename", id: "x", label: " " }), d);
  assert.deepEqual(tabsReducer(d, { type: "move", id: "instagram", to: 0 }).map((t) => t.id), ["instagram", "x", "facebook"]);
  assert.deepEqual(tabsReducer(d, { type: "move", id: "x", to: 99 }).map((t) => t.id), ["facebook", "instagram", "x"]);
  assert.equal(tabsReducer(d, { type: "move", id: "x", to: -1 }), d);
});

test("parseTabs drops bad entries; parseTab falls back to Feed", () => {
  const raw = JSON.stringify([{ id: "x", label: "X", url: "https://x.com", profile: "x", hosts: ["x.com"] }, { id: "BAD", label: "b", url: "https://b.com", profile: "b", hosts: ["b.com"] }, { id: "e", label: "E", url: "http://e.com", profile: "e", hosts: ["e.com"] }, { id: "x", label: "dup", url: "https://x.com", profile: "x", hosts: ["x.com"] }]);
  assert.deepEqual(parseTabs(raw).map((t) => t.id), ["x"]);
  assert.equal(parseTab("follows"), "follows");
  for (const bad of [null, undefined, "", "tiktok", 3]) assert.equal(parseTab(bad), FEED_TAB);
  assert.equal(siteOf("x")?.profile, "x");
  assert.equal(siteOf(FEED_TAB), undefined);
});

test("the standalone x/facebook/instagram modules are gone", () => {
  for (const n of ["x", "facebook", "instagram"]) assert.throws(() => readFileSync(new URL(`../${n}/index.ts`, import.meta.url)));
});
