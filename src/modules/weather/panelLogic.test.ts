import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDaily, dayName } from "./forecast.ts";
import { conditionGlyph, conditionText, isSevere, placeView, severePlaces, tempText, toC, toF, weatherSections } from "./panelLogic.ts";

describe("weather panelLogic", () => {
  it("toF/toC convert and round-trip", () => {
    assert.equal(toF(0), 32);
    assert.equal(toF(100), 212);
    assert.equal(toC(32), 0);
    assert.equal(Math.round(toC(toF(21.5)) * 10) / 10, 21.5);
  });
  it("tempText rounds and honors units, dash for missing", () => {
    assert.equal(tempText(21.4, "°C"), "21°C");
    assert.equal(tempText(0, "°F"), "32°F");
    assert.equal(tempText(null, "°C"), "—");
    assert.equal(tempText(NaN, "°F"), "—");
    assert.equal(tempText(undefined, "°C"), "—");
  });
  it("conditionText maps WMO codes", () => {
    assert.equal(conditionText(0), "Clear");
    assert.equal(conditionText(63), "Rain");
    assert.equal(conditionText(95), "Thunderstorm");
    assert.equal(conditionText(null), "—");
    assert.equal(conditionText(1234), "Unknown");
  });
  it("isSevere uses the severe flag, falls back to code >= 95", () => {
    assert.equal(isSevere({ severe: true }), true);
    assert.equal(isSevere({ severe: false, code: 99 }), false);
    assert.equal(isSevere({ code: 96 }), true);
    assert.equal(isSevere({ code: 3 }), false);
    assert.equal(isSevere({}), false);
  });
  it("placeView derives display fields from sparse rows", () => {
    const v = placeView({ id: "loc-1", place: "Austin, Texas", temp_c: 30, code: 1, high_c: 33, low_c: 20 }, "°F");
    assert.equal(v.name, "Austin, Texas");
    assert.equal(v.temp, "86°F");
    assert.equal(v.condition, "Mainly clear");
    assert.equal(v.range, "H 91°F · L 68°F");
    const sparse = placeView({ id: "loc-2", title: "Oslo: —" }, "°C");
    assert.equal(sparse.name, "Oslo");
    assert.equal(sparse.temp, "—");
    assert.equal(sparse.range, "");
  });
  it("conditionGlyph maps WMO codes", () => {
    assert.equal(conditionGlyph(0), "☀️");
    assert.equal(conditionGlyph(63), "🌧️");
    assert.equal(conditionGlyph(95), "⛈️");
    assert.equal(conditionGlyph(null), "");
  });
  it("severePlaces lists names of severe rows", () => {
    assert.deepEqual(severePlaces([{ place: "A", severe: true }, { place: "B" }]), ["A"]);
  });
  it("section ids", () => {
    assert.deepEqual(weatherSections.map((s) => s.id), ["alerts", "places", "forecast", "add", "actions"]);
  });
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, weatherSections.map((s) => s.id).sort());
  });
});

describe("forecast", () => {
  it("parses up to 5 days and names them", () => {
    const d = parseDaily({ time: ["2026-10-29", "2026-10-30", "bad"], temperature_2m_max: [10, "x"], temperature_2m_min: [2, 3], weather_code: [61] });
    assert.deepEqual(d, [{ day: "2026-10-29", hi: 10, lo: 2, code: 61 }, { day: "2026-10-30", hi: null, lo: 3, code: null }]);
    assert.deepEqual(parseDaily(undefined), []);
    assert.equal(parseDaily({ time: ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06"] }).length, 5);
    assert.equal(dayName("2026-10-30", 1), "Fri");
    assert.equal(dayName("2026-10-29", 0), "Today");
  });
});
