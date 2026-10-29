import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EMBED_TAB_H, FEED_TAB, SOCIAL_SITES, SOCIAL_TABS, parseTab, siteOf } from "./embedSites.ts";

test("EMBED_TAB_H matches geometry.rs", () => {
  const rs = readFileSync(new URL("../../../src-tauri/src/panels/geometry.rs", import.meta.url), "utf8");
  assert.equal(Number(/EMBED_TAB_H: f64 = (\d+)/.exec(rs)![1]), EMBED_TAB_H);
});

test("site configs are safe: https, host allowed, valid ids and profiles, unique", () => {
  assert.equal(new Set(SOCIAL_SITES.map((s) => s.id)).size, SOCIAL_SITES.length);
  for (const s of SOCIAL_SITES) {
    const u = new URL(s.url);
    assert.equal(u.protocol, "https:");
    assert.ok(/^[a-z0-9]{1,16}$/.test(s.id), s.id); // Rust is_valid_site
    assert.ok(/^[a-z0-9][a-z0-9-]{0,31}$/.test(s.profile), s.profile);
    assert.ok(s.hosts.some((h) => h === u.hostname || (h.startsWith("*.") && u.hostname.endsWith(h.slice(1)))), `${s.id} start host allowed`);
  }
});

test("tabs: Feed first, then X, Facebook, Instagram; unknown values fall back to Feed", () => {
  assert.deepEqual(SOCIAL_TABS.map((t) => t.label), ["Feed", "X", "Facebook", "Instagram"]);
  assert.equal(parseTab("facebook"), "facebook");
  for (const bad of [null, undefined, "", "tiktok", 3]) assert.equal(parseTab(bad), FEED_TAB);
  assert.equal(siteOf(FEED_TAB), undefined);
  assert.equal(siteOf("x")?.profile, "x");
});

test("the standalone x/facebook/instagram modules are gone", () => {
  for (const n of ["x", "facebook", "instagram"]) {
    assert.throws(() => readFileSync(new URL(`../${n}/index.ts`, import.meta.url)));
  }
});
