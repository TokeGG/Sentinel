import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deviceName, deviceState, homenetSections, ipKey, newDevices, sortDevices } from "./panelLogic.ts";

describe("homenet panelLogic", () => {
  it("ipKey orders numerically, invalid last", () => {
    assert.ok(ipKey("192.168.1.2") < ipKey("192.168.1.10"));
    assert.ok(ipKey("10.0.0.1") < ipKey("192.168.0.1"));
    assert.equal(ipKey("nope"), Infinity);
    assert.equal(ipKey("1.2.3.999"), Infinity);
    assert.equal(ipKey(null), Infinity);
  });
  it("sortDevices sorts by IP numerically without mutating", () => {
    const rows = [{ ip: "192.168.1.10", mac: "b" }, { ip: "192.168.1.2", mac: "a" }, { ip: "x", mac: "c" }];
    const out = sortDevices(rows);
    assert.deepEqual(out.map((r) => r.mac), ["a", "b", "c"]);
    assert.equal(rows[0].mac, "b");
  });
  it("newDevices returns rows whose id is not known", () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    assert.deepEqual(newDevices(rows, new Set(["1", "2"])).map((r) => r.id), [3]);
    assert.deepEqual(newDevices(rows, new Set(["1", "2", "3"])), []);
  });
  it("deviceName is the tag, else null (unknown)", () => {
    assert.equal(deviceName({ tag: " NAS " }), "NAS");
    assert.equal(deviceName({ tag: "" }), null);
    assert.equal(deviceName({ tag: null }), null);
    assert.equal(deviceName({}), null);
  });
  it("section ids", () => {
    assert.deepEqual(homenetSections.map((s) => s.id), ["summary", "devices", "scan", "tag", "map", "events"]);
  });
  it("every <Section id> in Panel.tsx is declared, and vice versa", () => {
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, homenetSections.map((s) => s.id).sort());
  });
});

describe("deviceState", () => {
  it("new wins, then unknown, else known", () => {
    assert.equal(deviceState({ isNew: true, unknown: true }), "new");
    assert.equal(deviceState({ isNew: false, unknown: true }), "unknown");
    assert.equal(deviceState({ isNew: false, unknown: false }), "known");
  });
});
