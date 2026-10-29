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
