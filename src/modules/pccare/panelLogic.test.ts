import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gbText, humanBytes, pccareSections, pctOf, previewSummary, splitRows, usageText } from "./panelLogic.ts";

describe("pccare panelLogic", () => {
  it("pctOf is used/total as a clamped percent, 0 for bad input", () => {
    assert.equal(pctOf(50, 200), 25);
    assert.equal(pctOf(1, 3), 33.3);
    assert.equal(pctOf(300, 200), 100);
    assert.equal(pctOf(-5, 200), 0);
    assert.equal(pctOf(5, 0), 0);
    assert.equal(pctOf(NaN, 10), 0);
  });
  it("gbText formats by source unit (ram is MB, disks are GB)", () => {
    assert.equal(gbText(8192, "mb"), "8.0 GB");
    assert.equal(gbText(123.456, "gb"), "123.5 GB");
    assert.equal(gbText(1024 ** 3 * 2, "bytes"), "2.0 GB");
    assert.equal(gbText(NaN, "gb"), "—");
  });
  it("usageText joins used / total", () => {
    assert.equal(usageText(4096, 16384, "mb"), "4.0 / 16.0 GB");
  });
  it("humanBytes scales B/KB/MB/GB", () => {
    assert.equal(humanBytes(0), "0 B");
    assert.equal(humanBytes(2048), "2 KB");
    assert.equal(humanBytes(5 * 1024 ** 2), "5.0 MB");
    assert.equal(humanBytes(3 * 1024 ** 3), "3.0 GB");
  });
  it("previewSummary counts files and totals sizes", () => {
    const s = previewSummary([{ size_bytes: 1024 }, { size_bytes: 3072 }]);
    assert.equal(s.count, 2);
    assert.equal(s.bytes, 4096);
    assert.equal(s.text, "2 files · 4 KB");
    assert.equal(previewSummary([{ size_bytes: 10 }]).text, "1 file · 10 B");
    assert.equal(previewSummary([]).text, "Nothing to clean");
    assert.equal(previewSummary([{ size_bytes: NaN }]).bytes, 0);
  });
  it("splitRows separates metrics from preview rows", () => {
    const m = splitRows([
      { id: "cpu", kind: "cpu", percent: 12 },
      { id: "ram", kind: "ram", used_mb: 4096, total_mb: 8192 },
      { id: "disk-C:", kind: "disk", mount: "C:", used_gb: 100, total_gb: 500 },
    ]);
    assert.equal(m.cpu, 12);
    assert.deepEqual(m.ram, { used: 4096, total: 8192 });
    assert.equal(m.disks.length, 1);
    assert.equal(m.hasMetrics, true);
    assert.equal(m.previewed, false);
    const p = splitRows([{ id: "tmp-0", kind: "tmp", path: "/tmp/a", size_bytes: 5 }]);
    assert.equal(p.hasMetrics, false);
    assert.equal(p.previewed, true);
    assert.deepEqual(p.files, [{ path: "/tmp/a", size_bytes: 5 }]);
    const e = splitRows([{ id: "tmp-none", kind: "tmp-none" }]);
    assert.equal(e.previewed, true);
    assert.equal(e.files.length, 0);
    assert.equal(splitRows([{ id: "x" }]).cpu, null);
  });
  it("section ids are unique", () => {
    const ids = pccareSections.map((s) => s.id);
    assert.deepEqual(ids, ["gauges", "disks", "cleanup", "actions"]);
  });
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, pccareSections.map((s) => s.id).sort());
  });
  it("splitRows/previewSummary never drop a previewed path", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: `tmp-${i}`, kind: "tmp", path: `/tmp/f${i}`, size_bytes: 1 }));
    const { files } = splitRows(rows);
    assert.equal(files.length, 5000);
    assert.equal(new Set(files.map((f) => f.path)).size, 5000);
    assert.equal(previewSummary(files).count, 5000);
  });
});
