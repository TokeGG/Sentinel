import { test } from "node:test";
import assert from "node:assert/strict";
import { genericFields, readModSettings, refreshLabel } from "./modSettings.ts";

test("readModSettings sanitizes", () => {
  assert.deepEqual(readModSettings(null), { assist: true, links: "default" });
  assert.deepEqual(readModSettings('{"assist":false,"links":"system"}'), { assist: false, links: "system" });
  assert.deepEqual(readModSettings('{"assist":"no","links":"ftp"}'), { assist: true, links: "default" });
  assert.deepEqual(readModSettings("nope"), { assist: true, links: "default" });
});

test("genericFields follow the manifest", () => {
  assert.deepEqual(genericFields({ id: "hub.x", panel: "web" }), ["notifications"]);
  const f = genericFields({ id: "hub.news", panel: "custom", badge: async () => 0, load: async () => [], schedule: { skill: "s", intervalMinutes: 5 } });
  assert.deepEqual(f, ["assist", "density", "defaultView", "links", "notifications", "refresh", "taste"]);
  assert.equal(refreshLabel(null), "Off");
  assert.equal(refreshLabel(240), "4 h");
});
