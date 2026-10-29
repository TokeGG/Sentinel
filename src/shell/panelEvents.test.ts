import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PANEL_CUSTOMIZE, panelLabel } from "./panelEvents.ts";

describe("panelLabel", () => {
  it("matches the Rust label scheme (ids.rs label())", () => {
    assert.equal(panelLabel("hub.notes"), "panel-hub_notes");
    assert.equal(panelLabel("a.b.c-d"), "panel-a_b_c-d");
  });
  it("names the customize event", () => assert.equal(PANEL_CUSTOMIZE, "panel-customize"));
});
