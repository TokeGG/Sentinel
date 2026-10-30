import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "./importText.ts";

describe("chunkText", () => {
  it("packs paragraphs into chunks and numbers titles", () => {
    assert.deepEqual(chunkText("  \n", "x"), []);
    assert.deepEqual(chunkText("a\n\n\n\nb", "T"), [{ title: "T", body: "a\n\nb" }]);
    const c = chunkText("aaaa\n\nbbbb\n\ncccccccccc", "T", 9);
    assert.deepEqual(c.map((x) => x.body), ["aaaa", "bbbb", "ccccccccc", "c"]);
    assert.equal(c[0].title, "T (1/4)");
  });
});
