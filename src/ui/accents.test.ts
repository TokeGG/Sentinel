import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { contrast, deltaE, hueGap, isHex, oklchHue } from "./color.ts";
import { TITLEBAR_H } from "../shell/layout.ts";

// Read the manifests as text so the test needs no Tauri / module registration.
const root = new URL("../", import.meta.url);
const accents = readdirSync(new URL("modules/", root))
  .map((d) => {
    try {
      const m = /accent:\s*"([^"]*)"/.exec(readFileSync(new URL(`modules/${d}/index.ts`, root), "utf8"));
      return m ? ([d, m[1]] as const) : null;
    } catch {
      return null;
    }
  })
  .filter((x): x is readonly [string, string] => x !== null);
const tokens = readFileSync(new URL("ui/tokens.css", root), "utf8");
const BASE = /--base:\s*(#[0-9a-f]{6})/i.exec(tokens)![1];

describe("module accents", () => {
  it("finds every module accent", () => assert.ok(accents.length >= 20, String(accents.length)));
  it("are all #rrggbb", () => {
    for (const [d, a] of accents) assert.ok(isHex(a), `${d}: ${a}`);
  });
  it("are readable on the base surface (WCAG contrast >= 4.5)", () => {
    for (const [d, a] of accents) assert.ok(contrast(a, BASE) >= 4.5, `${d} ${a}: ${contrast(a, BASE).toFixed(2)}`);
  });
  it("are mutually distinct (OKLab distance >= 0.06 and hue gap >= 10deg, or distance >= 0.10)", () => {
    for (let i = 0; i < accents.length; i++)
      for (let j = i + 1; j < accents.length; j++) {
        const [[n1, a], [n2, b]] = [accents[i], accents[j]];
        assert.ok(deltaE(a, b) >= 0.06, `${n1} ${a} vs ${n2} ${b}: dE ${deltaE(a, b).toFixed(3)}`);
        // The hue wheel is full (23 accents ~15deg apart): a near-neutral accent is told apart by OKLab distance >= 0.10 instead.
        assert.ok(hueGap(oklchHue(a), oklchHue(b)) >= 10 || deltaE(a, b) >= 0.1, `${n1} vs ${n2}: hue gap`);
      }
  });
});

describe("design token sync", () => {
  it("TITLEBAR_H matches --titlebar-h", () => {
    assert.equal(Number(/--titlebar-h:\s*(\d+)px/.exec(tokens)![1]), TITLEBAR_H);
  });
  it("--chrome-h matches CHROME_H in panels/geometry.rs", () => {
    const rs = readFileSync(new URL("../src-tauri/src/panels/geometry.rs", root), "utf8");
    assert.equal(Number(/--chrome-h:\s*(\d+)px/.exec(tokens)![1]), Number(/CHROME_H: f64 = (\d+)/.exec(rs)![1]));
  });
  it("derives the accent variables", () => {
    for (const v of ["--accent-soft", "--accent-line", "--accent-text"]) assert.match(tokens, new RegExp(v + ":"));
  });
});
