import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeLink } from "./safeLink.ts";

describe("safeLink", () => {
  it("allows only http(s)", () => {
    assert.equal(safeLink("https://x.test/1"), "https://x.test/1");
    assert.equal(safeLink("HTTP://x.test"), "HTTP://x.test");
    assert.equal(safeLink("javascript:alert(1)"), null);
    assert.equal(safeLink("file:///etc/passwd"), null);
    assert.equal(safeLink("//x.test"), null);
    assert.equal(safeLink(undefined), null);
    assert.equal(safeLink(42), null);
  });
});

it("queueLink appends, dedupes and caps the pending list", async () => {
  const { queueLink } = await import("./safeLink.ts");
  assert.equal(queueLink(null, "https://a/"), '["https://a/"]');
  assert.equal(queueLink('["https://a/","https://b/"]', "https://a/"), '["https://b/","https://a/"]');
  assert.equal(queueLink("junk", "https://a/"), '["https://a/"]');
  let q: string | null = null;
  for (let i = 0; i < 30; i++) q = queueLink(q, `https://x/${i}`);
  assert.equal(JSON.parse(q!).length, 20);
});
