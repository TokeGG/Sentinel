import { test } from "node:test";
import assert from "node:assert/strict";
import { countsHidden, DEFAULT_SYS, parseSys, sanitizeSys } from "./sysPrefs.ts";

test("defaults keep background work off", () => {
  const p = parseSys(null);
  assert.deepEqual(p, DEFAULT_SYS);
  assert.equal(p.autoClearDays, 0);
  assert.equal(p.scanHours, 0);
  assert.equal(p.incognito, false);
});
test("clamps and rejects junk", () => {
  const p = sanitizeSys({ tempWarnC: 500, diskAlertPct: "70", startupDelaySec: -3, lowPower: "yes", presentationPanels: ["a", "a", 3] });
  assert.equal(p.tempWarnC, 110);
  assert.equal(p.diskAlertPct, 70);
  assert.equal(p.startupDelaySec, 0);
  assert.equal(p.lowPower, false);
  assert.deepEqual(p.presentationPanels, ["a"]);
  assert.deepEqual(parseSys("{bad"), DEFAULT_SYS);
});
test("counts hidden by toggle or presentation", () => {
  assert.equal(countsHidden(DEFAULT_SYS), false);
  assert.equal(countsHidden({ ...DEFAULT_SYS, presentation: true }), true);
  assert.equal(countsHidden({ ...DEFAULT_SYS, hideCounts: true }), true);
});
