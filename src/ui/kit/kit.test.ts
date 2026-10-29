import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { humanSize, ago, gaugeTone, pct, sparkPoints, statusText, onAccent, safeVars, utcDate } from "./format.ts";

const NOW = new Date("2026-10-28T12:00:00Z");
const before = (ms: number) => new Date(NOW.getTime() - ms);

describe("ago", () => {
  it("says just now under a minute (and for future dates)", () => {
    assert.equal(ago(before(30_000), NOW), "just now");
    assert.equal(ago(new Date(NOW.getTime() + 60_000), NOW), "just now");
  });
  it("uses minutes, hours, days", () => {
    assert.equal(ago(before(5 * 60_000), NOW), "5m");
    assert.equal(ago(before(3 * 3_600_000), NOW), "3h");
    assert.equal(ago(before(2 * 86_400_000), NOW), "2d");
  });
  it("accepts ISO strings and rejects garbage", () => {
    assert.equal(ago("2026-10-28T11:55:00Z", NOW), "5m");
    assert.equal(ago("not a date", NOW), "");
  });
});

describe("pct", () => {
  it("computes a percentage", () => assert.equal(pct(25, 50), 50));
  it("clamps to 0-100", () => {
    assert.equal(pct(-5, 10), 0);
    assert.equal(pct(500, 10), 100);
  });
  it("is 0 for zero/invalid max or NaN value", () => {
    assert.equal(pct(5, 0), 0);
    assert.equal(pct(NaN, 10), 0);
    assert.equal(pct(5, NaN), 0);
  });
});

const parse = (s: string) =>
  s === "" ? [] : s.split(" ").map((p) => p.split(",").map(Number) as [number, number]);

describe("sparkPoints", () => {
  it("keeps every point inside the box", () => {
    const pts = parse(sparkPoints([3, 9, 1, 7, 5], 100, 20));
    assert.equal(pts.length, 5);
    for (const [x, y] of pts) {
      assert.ok(x >= 0 && x <= 100, `x ${x}`);
      assert.ok(y >= 0 && y <= 20, `y ${y}`);
    }
    assert.equal(pts[0][0], 0);
    assert.equal(pts[4][0], 100);
    assert.equal(pts[1][1], 0); // max at top
    assert.equal(pts[2][1], 20); // min at bottom
  });
  it("returns empty for no points", () => assert.equal(sparkPoints([], 100, 20), ""));
  it("draws a flat line for one point or a flat series, no NaN", () => {
    for (const s of [sparkPoints([4], 100, 20), sparkPoints([2, 2, 2], 100, 20)]) {
      assert.ok(!s.includes("NaN"), s);
      const pts = parse(s);
      assert.ok(pts.length >= 2);
      for (const [, y] of pts) assert.equal(y, 10);
    }
  });
  it("skips non-finite values", () => {
    const s = sparkPoints([1, NaN, 3, Infinity], 10, 10);
    assert.ok(!s.includes("NaN") && !s.includes("Infinity"), s);
    assert.equal(parse(s).length, 2);
  });
});

describe("statusText", () => {
  it("shows an error first", () => {
    assert.equal(statusText(before(60_000), "5 min", "offline", NOW), "Error: offline");
  });
  it("shows updated time and auto-refresh", () => {
    assert.equal(statusText(before(5 * 60_000), "5 min", null, NOW), "Updated 5m ago · Auto-refresh 5 min");
    assert.equal(statusText(before(1000), null, null, NOW), "Updated just now · Auto-refresh off");
  });
  it("handles never-updated", () => {
    assert.equal(statusText(null, null, null, NOW), "Not updated yet · Auto-refresh off");
    assert.equal(statusText("garbage", undefined, undefined, NOW), "Not updated yet · Auto-refresh off");
  });
});

describe("onAccent", () => {
  it("keeps white on the default blue and on near-black", () => {
    assert.equal(onAccent("#396cd8"), "light");
    assert.equal(onAccent("#0b1020"), "light");
  });
  it("picks dark text on light accents", () => {
    assert.equal(onAccent("#ffe066"), "dark");
    assert.equal(onAccent("#00e5ff"), "dark");
    assert.equal(onAccent("#FFFFFF"), "dark");
  });
  it("mid grey #777777: white 4.48:1 vs near-black (#0a0f1f) 4.26:1 -> light", () => {
    assert.equal(onAccent("#777777"), "light");
  });
  it("invalid input falls back to light", () => {
    for (const v of ["", "#fff", "red", "url(x)", "#12345g", undefined as unknown as string]) {
      assert.equal(onAccent(v), "light");
    }
  });
});

describe("safeVars", () => {
  it("keeps known vars with valid values", () => {
    assert.deepEqual(safeVars({ "--accent": "#ffe066", "--density": "0.75", "--font-scale": "1.2", "--tint": "0" }), {
      "--accent": "#ffe066", "--density": "0.75", "--font-scale": "1.2", "--tint": "0",
    });
  });
  it("drops unknown keys, bad accents and non-finite numbers", () => {
    assert.deepEqual(
      safeVars({
        "--accent": "red", "--density": "NaN", "--font-scale": "Infinity", "--tint": "1e999",
        "--surface": "#000000", color: "red",
      }),
      {},
    );
    assert.deepEqual(safeVars({ "--density": "calc(1)", "--tint": "", "--font-scale": "abc" }), {});
  });
  it("tolerates undefined and non-string values", () => {
    assert.deepEqual(safeVars(undefined), {});
    assert.deepEqual(safeVars({ "--density": 1 as unknown as string }), {});
  });
});

describe("gaugeTone", () => {
  it("warns at warnAt, bad at max(90, warnAt)", () => {
    assert.equal(gaugeTone(40, 100, 50), "ok");
    assert.equal(gaugeTone(60, 100, 50), "warn");
    assert.equal(gaugeTone(90, 100, 50), "bad");
  });
  it("a warnAt above 90 delays bad until warnAt", () => {
    assert.notEqual(gaugeTone(92, 100, 95), "bad");
    assert.equal(gaugeTone(95, 100, 95), "bad");
  });
  it("defaults: warn at 75% of max, bad at 90%", () => {
    assert.equal(gaugeTone(74, 100), "ok");
    assert.equal(gaugeTone(75, 100), "warn");
    assert.equal(gaugeTone(90, 100), "bad");
  });
});

describe("utcDate", () => {
  it("treats SQLite datetimes as UTC and leaves others alone", () => {
    assert.equal(utcDate("2026-10-28 12:00:00").toISOString(), "2026-10-28T12:00:00.000Z");
    assert.equal(utcDate("2026-10-28T12:00:00Z").toISOString(), "2026-10-28T12:00:00.000Z");
  });
});

describe("humanSize", () => {
  it("formats bytes through GB", () => {
    assert.equal(humanSize(0), "0 B");
    assert.equal(humanSize(1), "1 B");
    assert.equal(humanSize(1023), "1023 B");
    assert.equal(humanSize(1024), "1.0 KB");
    assert.equal(humanSize(1536 * 1024), "1.5 MB");
    assert.equal(humanSize(5 * 1024 ** 3), "5.0 GB");
  });
  it("rounds up across unit boundaries instead of showing 1024 KB", () => {
    assert.equal(humanSize(1024 * 1024 - 1), "1.0 MB");
    assert.equal(humanSize(1024 ** 3 - 1), "1.0 GB");
  });
  it("is safe for bad input", () => {
    assert.equal(humanSize(-5), "0 B");
    assert.equal(humanSize(NaN), "0 B");
    assert.equal(humanSize(Infinity), "0 B");
  });
});
