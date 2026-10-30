import { DEFAULT_UI, parseUi, sanitizeUi } from "./uiDefaults.ts";
import { parseBotSettings } from "../../modules/bot/botSettings.ts";
import { socialOptions } from "../../modules/social/panelLogic.ts";
import { describe, it } from "node:test";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cmdFor, comboOf, effective, normCombo, rebind } from "./keymapUser.ts";
import { parseIds, quickSwitchTarget, resolveNamed, sanitizeFolders, sanitizeGroups } from "./collections.ts";
import { cleanView, sanitizeViews, stepZoom, viewStyle } from "./panelView.ts";
import { cleanCustom, customVars, seasonOf, toTitleStyle } from "./look.ts";

const ev = (key: string, m: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...m });

test("keymap: normalize, defaults, rebind conflicts", () => {
  assert.equal(normCombo("ctrl + k"), "Ctrl+K");
  assert.equal(normCombo("shift+alt+q"), "Alt+Shift+Q");
  assert.equal(normCombo("k"), null);
  assert.equal(normCombo(""), "");
  assert.equal(comboOf(ev(" ", { ctrlKey: true })), "Ctrl+Space");
  const m = effective({ palette: "Ctrl+P", help: 5 });
  assert.equal(m.palette, "Ctrl+P");
  assert.equal(m.help, "F1");
  assert.deepEqual(cmdFor(m, ev("p", { ctrlKey: true })), { type: "palette" });
  assert.deepEqual(cmdFor(m, ev("q", { altKey: true })), { type: "quickSwitch" });
  const r = rebind(m, "help", "Ctrl+P");
  assert.ok("error" in r && /Command palette/.test(r.error));
  const ok = rebind(m, "help", "");
  assert.ok("map" in ok && ok.map.help === "");
  assert.equal(cmdFor("map" in ok ? ok.map : m, ev("F1")), null);
});

test("smart folders, groups, terminal resolve, quick switch", () => {
  assert.deepEqual(sanitizeFolders({ Work: " todo ", "bad/": "x", Empty: "" }), { Work: "todo" });
  assert.deepEqual(sanitizeGroups({ Morning: ["hub.news", "hub.news", 3, "a b"] }), { Morning: ["hub.news"] });
  assert.deepEqual(parseIds("hub.a, hub.b hub.a"), ["hub.a", "hub.b"]);
  assert.deepEqual(resolveNamed("folder work", { Work: "q" }, {}), { kind: "folder", name: "Work" });
  assert.equal(resolveNamed("group nope", {}, {}), null);
  assert.equal(quickSwitchTarget(["a", "b", "c"], (id) => id !== "c"), "b");
  assert.equal(quickSwitchTarget([], () => true), null);
});

test("panel view prefs clamp and style", () => {
  assert.deepEqual(cleanView({ zoom: 9, opacity: 0, lock: true }), { zoom: 2, opacity: 0.3, lock: true, keepScroll: true });
  assert.deepEqual(Object.keys(sanitizeViews({ "hub.x": {}, "bad id!": {} })), ["hub.x"]);
  assert.equal(stepZoom(1, 1), 1.1);
  assert.equal(stepZoom(0.5, -1), 0.5);
  assert.equal(stepZoom(1.7, 0), 1);
  assert.deepEqual(viewStyle(cleanView({})), {});
  assert.deepEqual(viewStyle(cleanView({ zoom: 1.2 })), { zoom: "1.2" });
});

test("look: title style, custom theme, seasons", () => {
  assert.equal(toTitleStyle("compact"), "compact");
  assert.equal(toTitleStyle("x"), "normal");
  const c = cleanCustom({ base: "#ABCDEF", text: "red", font: "Georgia" });
  assert.equal(c.base, "#abcdef");
  assert.equal(c.text, "#e6eaf4");
  assert.match(customVars(c)["--font-body"], /Georgia/);
  assert.equal(customVars(cleanCustom({}))["--font-body"], undefined);
  assert.equal(seasonOf(new Date(2026, 9, 30)), "halloween");
  assert.equal(seasonOf(new Date(2026, 11, 20)), "holidays");
  assert.equal(seasonOf(new Date(2026, 6, 1)), "summer");
  assert.equal(seasonOf(new Date(2026, 0, 1)), "winter");
});

describe("ui defaults", () => {
  it("falls back to the old hard-coded values", () => {
    assert.deepEqual(parseUi(null), DEFAULT_UI);
    assert.deepEqual(parseUi("nope"), DEFAULT_UI);
    assert.deepEqual(DEFAULT_UI, { briefingRows: 5, terminalRows: 6, paletteResults: 40, terminalLog: 14 });
  });
  it("clamps and rounds, ignores junk", () => {
    const u = sanitizeUi({ briefingRows: 99, terminalRows: 0, paletteResults: "60.4", terminalLog: "x" });
    assert.deepEqual(u, { briefingRows: 20, terminalRows: 1, paletteResults: 60, terminalLog: 14 });
    assert.deepEqual(sanitizeUi([1, 2]), DEFAULT_UI);
  });
});

describe("bot time limit setting", () => {
  it("0 / missing = learned; clamped to 30..600", () => {
    assert.equal(parseBotSettings("{}").wallClockSec, 0);
    assert.equal(parseBotSettings('{"wallClockSec":5}').wallClockSec, 30);
    assert.equal(parseBotSettings('{"wallClockSec":9999}').wallClockSec, 600);
    assert.equal(parseBotSettings('{"wallClockSec":-3}').wallClockSec, 0);
  });
});

describe("social page size option", () => {
  it("defaults to the old page size", () => {
    const o = socialOptions.find((x) => x.key === "pageSize");
    assert.equal(o?.default, 100);
  });
});
