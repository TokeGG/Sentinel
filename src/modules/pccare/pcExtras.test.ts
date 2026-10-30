import { test } from "node:test";
import assert from "node:assert/strict";
import { addSamples, forecast, forecastText, parseHist } from "./forecast.ts";
import { diskAlerts, hotSensors, isNewer, overlayLines, parseUpdates, planDesktop, powerShare, speedSeries } from "./alerts.ts";
import { closePlan, parseProfiles, runningProfile, splitNames } from "./gameProfiles.ts";

test("disk history keeps one sample per disk per day", () => {
  let h = addSamples([], [{ mount: "C:", used_gb: 10, total_gb: 100 }], "2026-01-01");
  h = addSamples(h, [{ mount: "C:", used_gb: 11, total_gb: 100 }], "2026-01-01");
  assert.equal(h.length, 1);
  assert.equal(h[0].used, 11);
  assert.deepEqual(parseHist("nope"), []);
});
test("forecast: linear growth, flat, too few", () => {
  const h = ["01", "02", "03", "04"].map((d, i) => ({ day: `2026-01-${d}`, mount: "C:", used: 50 + i * 2, total: 100 }));
  const f = forecast(h, "C:");
  assert.equal(f.perDay, 2);
  assert.equal(f.daysLeft, 22); // 44 GB free / 2
  assert.equal(forecast(h.map((s) => ({ ...s, used: 50 })), "C:").daysLeft, null);
  assert.match(forecastText(forecast(h.slice(0, 1), "C:")), /2 more/);
});
test("threshold alerts", () => {
  assert.equal(diskAlerts([{ mount: "C:", used_gb: 95, total_gb: 100 }, { mount: "D:", used_gb: 1, total_gb: 100 }], 90).length, 1);
  assert.deepEqual(hotSensors([{ label: "CPU", temp: 90 }, { label: "X", temp: null }], 85), ["CPU at 90°C (warn at 85°C)"]);
});
test("power share is best effort", () => {
  assert.equal(powerShare([]), null);
  assert.equal(powerShare([{ pid: 1, name: "a", cpu: 0, mem_mb: 1 }]), null);
  const s = powerShare([{ pid: 1, name: "a", cpu: 30, mem_mb: 1 }, { pid: 2, name: "a", cpu: 30, mem_mb: 1 }, { pid: 3, name: "b", cpu: 40, mem_mb: 1 }])!;
  assert.deepEqual(s[0], { name: "a", share: 60 });
});
test("speed series oldest first, overlay text", () => {
  assert.deepEqual(speedSeries([{ mbps: 3 }, { mbps: 1 }]), [1, 3]);
  assert.deepEqual(overlayLines({ cpu: 12.4, ram: 50, gpu: null, temp: null }), ["CPU 12%", "RAM 50%", "GPU n/a", "TEMP n/a"]);
});
test("desktop sort leaves shortcuts", () => {
  const m = planDesktop("C:\\Users\\u\\Desktop", [{ name: "a.lnk", size: 1, modified: 0 }, { name: "b.pdf", size: 1, modified: 0 }, { name: "desktop.ini", size: 1, modified: 0 }]);
  assert.deepEqual(m.map((x) => x.name), ["b.pdf"]);
});
test("update list and version compare", () => {
  assert.equal(parseUpdates('[{"name":"x","repo":"a/b","installed":"1.0"},{"name":"y","repo":"bad"}]').length, 1);
  assert.equal(isNewer("v1.2.0", "1.1.9"), true);
  assert.equal(isNewer("1.2", "1.2.0"), false);
  assert.equal(isNewer("2.0", ""), false);
});
test("game profiles: plan excludes protected and the game", () => {
  const p = parseProfiles('[{"game":"Game.EXE","close":["chrome.exe","explorer.exe","game.exe"]}]');
  assert.equal(p[0].game, "game.exe");
  assert.equal(p[0].pauseSentinel, true);
  const procs = [{ pid: 1, name: "game.exe" }, { pid: 2, name: "Chrome.exe" }, { pid: 3, name: "explorer.exe" }];
  assert.equal(runningProfile(p, procs)?.game, "game.exe");
  assert.deepEqual(closePlan(p[0], procs).map((x) => x.pid), [2]);
  assert.deepEqual(splitNames("a.exe, B.exe\na.exe"), ["a.exe", "b.exe"]);
  assert.deepEqual(parseProfiles("{"), []);
});
