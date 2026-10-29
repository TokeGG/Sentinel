import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deviceInfo, parseOpen, portsByIp, portsText } from "./deviceInfo.ts";
import { isRandomMac, normalizeMac, vendorOf } from "./oui.ts";

describe("oui", () => {
  it("normalizes Windows and Unix MAC forms", () => {
    assert.equal(normalizeMac("B8-27-EB-01-02-03"), "b8:27:eb:01:02:03");
    assert.equal(normalizeMac("b827.eb01.0203"), "b8:27:eb:01:02:03");
    assert.equal(normalizeMac("xx"), null);
  });
  it("vendors, randomized and unknown", () => {
    assert.equal(vendorOf("b8-27-eb-01-02-03"), "Raspberry Pi");
    assert.equal(vendorOf("00:0c:29:aa:bb:cc"), "VMware");
    assert.equal(vendorOf("08:00:27:aa:bb:cc"), "VirtualBox");
    assert.equal(vendorOf("10:34:56:78:9a:bc"), "unknown vendor");
    assert.equal(vendorOf("da:a1:19:00:00:01"), "private (randomized) MAC");
    assert.equal(isRandomMac("02:00:00:00:00:00"), true);
    assert.equal(vendorOf("nonsense"), "unknown vendor");
  });
});

describe("device info", () => {
  it("open ports come from the newest allowed scan of that IP", () => {
    assert.deepEqual(parseOpen("open: 22, 80"), [22, 80]);
    assert.deepEqual(parseOpen("no open ports among 14 probed"), []);
    assert.equal(parseOpen("error: boom"), null);
    const m = portsByIp([{ target: "192.168.1.5", summary: "open: 22" }, { target: "192.168.1.5", summary: "open: 22, 443" }, { target: "x", summary: "error: y" }]);
    assert.deepEqual(m.get("192.168.1.5"), [22, 443]);
    assert.equal(m.has("x"), false);
  });
  it("view model", () => {
    const i = deviceInfo({ ip: "192.168.1.5", mac: "b8:27:eb:00:00:01", hostname: "pi", notes: "n", tag: "NAS", first_seen: null, last_seen: "2026-01-01" }, new Map([["192.168.1.5", [22]]]));
    assert.deepEqual([i.vendor, i.hostname, i.firstSeen, i.ports], ["Raspberry Pi", "pi", "before tracking", [22]]);
    assert.equal(portsText(null), "not scanned");
    assert.equal(portsText([]), "none open");
  });
});
