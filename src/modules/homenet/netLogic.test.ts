import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffScan, mapLayout, portChanges, routerUrl, uptimePct } from "./netLogic.ts";

describe("netLogic", () => {
  it("diffScan finds new devices and IP changes", () => {
    const e = diffScan(new Map([["aa", "10.0.0.2"], ["bb", "10.0.0.3"]]), [{ mac: "aa", ip: "10.0.0.2" }, { mac: "bb", ip: "10.0.0.9" }, { mac: "cc", ip: "10.0.0.4" }]);
    assert.deepEqual(e.map((x) => x.kind), ["ip", "new"]);
  });
  it("portChanges compares the last two scans per IP", () => {
    const m = portChanges([
      { target: "10.0.0.2", summary: "open: 22, 80" }, { target: "10.0.0.2", summary: "open: 80, 443" },
      { target: "10.0.0.3", summary: "open: 22" }, { target: "10.0.0.3", summary: "error" }, { target: "10.0.0.3", summary: "open: 22" },
    ]);
    assert.deepEqual(m.get("10.0.0.2"), { opened: [443], closed: [22] });
    assert.equal(m.has("10.0.0.3"), false);
  });
  it("uptime, map and router link", () => {
    assert.equal(uptimePct([]), null);
    assert.equal(uptimePct([{ up: 1 }, { up: 0 }, { up: true }, { up: 1 }]), 75);
    const n = mapLayout([{ mac: "g", ip: "192.168.1.1", label: "R" }, { mac: "a", ip: "192.168.1.5", label: "A" }], "192.168.1.1");
    assert.equal(n[0].label, "R");
    assert.ok(n[0].gateway && !n[1].gateway);
    assert.equal(n.length, 2);
    assert.equal(routerUrl("192.168.1.1"), "http://192.168.1.1/");
    assert.equal(routerUrl("8.8.8.8"), null);
    assert.equal(routerUrl("192.168.1.1/x"), null);
  });
});
