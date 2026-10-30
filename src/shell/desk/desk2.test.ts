import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTheme, skyPhase } from "./theme.ts";
import { normalizeHotkey, toastFor } from "./desktopLogic.ts";
import { greeting, likedRows, movers, section, todayRows } from "./briefingLogic.ts";
import { helpEntries, TOUR } from "./helpLogic.ts";

describe("theme", () => {
  it("phases by hour", () => {
    assert.deepEqual([2, 6, 12, 19, 23, -1].map(skyPhase), ["night", "dawn", "day", "dusk", "night", "night"]);
    assert.ok(isTheme("midnight"));
    assert.ok(!isTheme("nope"));
  });
});
describe("desktop", () => {
  it("normalizes hotkeys", () => {
    assert.equal(normalizeHotkey("ctrl + shift + space"), "Ctrl+Shift+Space");
    assert.equal(normalizeHotkey(""), "");
    assert.equal(normalizeHotkey("k"), null);
    assert.equal(normalizeHotkey("Ctrl+Shift"), null);
    assert.equal(normalizeHotkey("alt+n"), "Alt+N");
  });
  it("toasts counts only when enabled and rising", () => {
    assert.equal(toastFor(1, 3, true, false), "2 new notifications (3 unread)");
    assert.equal(toastFor(3, 3, true, false), null);
    assert.equal(toastFor(1, 3, false, false), null);
    assert.equal(toastFor(1, 3, true, true), null);
  });
});
describe("briefing", () => {
  it("filters today, liked, movers", () => {
    const now = new Date(2026, 9, 29, 9);
    const today = new Date(2026, 9, 29, 15).toISOString(), tomorrow = new Date(2026, 9, 30, 15).toISOString();
    assert.deepEqual(todayRows([{ title: "a", start: today }, { title: "b", start: tomorrow }], now).map((r) => r.title), ["a"]);
    assert.equal(likedRows([{ liked: 1 }, { liked: 0 }]).length, 1);
    assert.deepEqual(movers([{ symbol: "A", change_pct: 1 }, { symbol: "B", change_pct: -3 }], 1), ["B -3.00%"]);
    assert.deepEqual(section("x", "X", [{ title: "t" }, {}]), { id: "x", name: "X", lines: ["t"], count: 1 });
    assert.equal(greeting(now), "Good morning");
  });
});
describe("help", () => {
  it("builds entries from manifests and filters", () => {
    const e = helpEntries([{ id: "b.b", name: "Beta", description: "two", schedule: {} }, { id: "a.a", name: "Alpha", description: "one" }]);
    assert.deepEqual(e.map((x) => x.name), ["Alpha", "Beta"]);
    assert.equal(e[1].extras.length, 1);
    assert.equal(helpEntries([{ id: "a.a", name: "Alpha", description: "one" }], "zzz").length, 0);
    assert.ok(TOUR.length >= 3);
  });
});

import { speechScript } from "./briefingLogic.ts";
it("speechScript reads counts and first lines", () => {
  const s = speechScript("Good morning", [["Mail", 3]], [{ id: "c", name: "Today", lines: ["Standup", "Bill"], count: 2 }, { id: "d", name: "Deals", lines: [], count: 0 }]);
  assert.equal(s, "Good morning. You have 3 in Mail. Today: Standup; Bill.");
});
