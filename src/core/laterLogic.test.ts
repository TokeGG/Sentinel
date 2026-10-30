import test from "node:test";
import assert from "node:assert/strict";
import { mergeLater } from "./laterLogic.ts";

test("mergeLater newest first across kinds", () => {
  const r = mergeLater([{ title: "A", link: "https://a", saved_at: "2026-01-02" }], [{ video_id: "x y", title: "V", added_at: "2026-01-03" }], [{ url: "https://l", title: "", saved_at: "2026-01-01" }]);
  assert.deepEqual(r.map((i) => i.kind), ["video", "news", "link"]);
  assert.equal(r[0].url, "https://www.youtube.com/watch?v=x%20y");
  assert.equal(r[2].title, "https://l");
});
