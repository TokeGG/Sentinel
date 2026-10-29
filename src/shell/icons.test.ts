import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { ICONS, isPathData, drawIcon } from "./icons.ts";
import { RINGS } from "../core/customizeChecks.ts";

const MODULE_ICONS = ["notes", "news", "pccare", "weather", "homenet", "github", "youtube", "finance", "deals",
  "email", "social", "calendar", "backup", "pentest", "clipboard", "filesearch", "discord", "chat", "skills", "bot", "congress", "games", "media", "browser"];
const EXTRA = ["core"];

test("isPathData accepts SVG path data and rejects anything else", () => {
  for (const ok of ["M3 3h18v18H3z", "M12 2a10 10 0 1 0 .01 0", "M1,2 L3,4 c-1.5.5-2 1 -2 1Z", "m0 0l1e1 2"])
    assert.ok(isPathData(ok), ok);
  for (const bad of ["", "L1 1", "M1 1 X2", "M1 1 url(x)", "<path>", " ", "M"]) assert.ok(!isPathData(bad), bad);
  assert.ok(!isPathData(5 as unknown as string));
});

test("every ICONS entry parses as a non-empty path string and starts with M", () => {
  assert.deepEqual(Object.keys(ICONS).sort(), [...MODULE_ICONS, ...EXTRA].sort());
  for (const [k, d] of Object.entries(ICONS)) {
    assert.ok(d.startsWith("M") && isPathData(d), `${k}: ${d}`);
    assert.ok(d.length < 260, `${k} path is long (${d.length})`);
  }
});

// Manifests are the single source of truth; read their static ring/icon
// literals (the index files import Tauri, so they cannot load under node).
const dir = new URL("../modules/", import.meta.url);
// (a folder without index.ts is not a module yet)
const meta = readdirSync(dir).filter((name) => existsSync(new URL(`${name}/index.ts`, dir))).map((name) => {
  const src = readFileSync(new URL(`${name}/index.ts`, dir), "utf8");
  return { name, ring: src.match(/^\s*ring: "([^"]*)",/m)?.[1], icon: src.match(/^\s*icon: "([^"]*)",/m)?.[1] };
});

test("every module's ring and icon are valid", () => {
  assert.equal(meta.length, MODULE_ICONS.length);
  for (const { name, ring, icon } of meta) {
    assert.ok(ring && (RINGS as readonly string[]).includes(ring), `${name} ring ${ring}`);
    assert.equal(icon, name, `${name} icon is its short name`);
    assert.ok(icon in ICONS, `${name} icon ${icon}`);
  }
});

test("every ICONS key is used by a module or is a shell/future glyph", () => {
  const used = new Set(meta.map((x) => x.icon));
  for (const k of Object.keys(ICONS)) assert.ok(used.has(k) || EXTRA.includes(k), k);
});

test("drawIcon draws nothing for an unknown key and strokes a known one", () => {
  const calls: string[] = [];
  const ctx = new Proxy({}, {
    get: (_t, p) => (typeof p === "string" ? (...a: unknown[]) => void calls.push(`${p}:${a.length}`) : undefined),
    set: (_t, p) => (calls.push(`set ${String(p)}`), true),
  }) as unknown as CanvasRenderingContext2D;
  drawIcon(ctx, "nope", 10, 10, 24, "#fff");
  assert.equal(calls.length, 0);
  (globalThis as { Path2D?: unknown }).Path2D ??= class { d: string; constructor(d: string) { this.d = d; } };
  drawIcon(ctx, "notes", 10, 10, 24, "#fff");
  assert.ok(calls.includes("stroke:1") && calls.includes("set strokeStyle"));
});
