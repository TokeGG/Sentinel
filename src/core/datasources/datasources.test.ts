import { test } from "node:test";
import assert from "node:assert/strict";
import { DATA_SOURCES, sourcesFor } from "./registry.ts";
import { FIXTURES } from "./fixtures.ts";
import { CATEGORIES, isCategory } from "../categories.ts";

test("every source: unique id, valid category, https request, fixture parses", () => {
  const ids = new Set<string>();
  for (const s of DATA_SOURCES) {
    assert.ok(!ids.has(s.id), s.id); ids.add(s.id);
    assert.ok(isCategory(s.category), s.id);
    const f = FIXTURES[s.id];
    assert.ok(f, `fixture for ${s.id}`);
    assert.match(s.request(f.q).url, /^https:\/\//, s.id);
    const rows = s.parse(f.text, f.q);
    assert.ok(rows.length >= 1, s.id);
    assert.match(rows[0].title, f.first, s.id);
    assert.ok(rows.length <= 10);
  }
});

test("garbage responses throw (shown as a Test error), local filters apply", () => {
  for (const s of DATA_SOURCES) assert.throws(() => { const r = s.parse("<html>blocked</html>", ""); if (!r.length) throw new Error("empty"); }, s.id);
  const kev = DATA_SOURCES.find((s) => s.id === "cisa-kev")!;
  assert.equal(kev.parse(FIXTURES["cisa-kev"].text, "acme").length, 1);
  const leg = DATA_SOURCES.find((s) => s.id === "congress-legislators")!;
  assert.equal(leg.parse(FIXTURES["congress-legislators"].text, "CA")[0].detail, "sen CA · Independent");
});

test("osv request is a POST with ecosystem; every category has 2+ sources", () => {
  const r = DATA_SOURCES.find((s) => s.id === "osv")!.request("PyPI:requests");
  assert.equal(r.method, "POST");
  assert.deepEqual(JSON.parse(r.body!), { package: { name: "requests", ecosystem: "PyPI" } });
  for (const c of CATEGORIES) assert.ok(sourcesFor(c).length >= 2, c);
});
