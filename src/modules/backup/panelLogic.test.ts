import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backupSections, folderName, snapshotsOf, stampOf, whenText } from "./panelLogic.ts";

const NOW = new Date("2026-10-28T12:00:00Z");
const stamp = (d: Date) => Math.floor(d.getTime() / 1000);

describe("backup panelLogic", () => {
  it("stampOf reads the epoch seconds out of the backup folder name", () => {
    const d = new Date("2026-10-28T11:00:00Z");
    assert.equal(stampOf(`D:\\b\\sentinel-backup-${stamp(d)}`)?.getTime(), d.getTime());
    assert.equal(stampOf(`/x/sentinel-backup-${stamp(d)}/`)?.getTime(), d.getTime());
    assert.equal(stampOf("/x/other"), null);
    assert.equal(stampOf(""), null);
  });
  it("whenText is relative when recent, a date when old, unknown when null", () => {
    assert.equal(whenText(new Date(NOW.getTime() - 20_000), NOW), "just now");
    assert.equal(whenText(new Date(NOW.getTime() - 5 * 60_000), NOW), "5m ago");
    assert.equal(whenText(new Date(NOW.getTime() - 3 * 3600_000), NOW), "3h ago");
    assert.equal(whenText(new Date(NOW.getTime() - 3 * 86400_000), NOW), "3d ago");
    assert.equal(whenText(new Date("2026-08-01T10:00:00Z"), NOW), "2026-08-01");
    assert.equal(whenText(null, NOW), "unknown time");
    assert.equal(whenText(new Date("nope"), NOW), "unknown time");
  });
  it("folderName handles both separators and trailing slashes", () => {
    assert.equal(folderName("C:\\a\\b\\snap"), "snap");
    assert.equal(folderName("/a/b/snap/"), "snap");
    assert.equal(folderName(""), "");
  });
  it("snapshotsOf keeps rows with a path, newest stamp first", () => {
    const a = `/b/sentinel-backup-${stamp(new Date("2026-10-01T00:00:00Z"))}`;
    const b = `/b/sentinel-backup-${stamp(new Date("2026-10-20T00:00:00Z"))}`;
    const s = snapshotsOf([{ id: a, title: "x" }, { id: b }, { title: "no id" }, { id: "" }]);
    assert.deepEqual(s.map((x) => x.path), [b, a]);
    assert.equal(s[0].name, folderName(b));
    assert.deepEqual(snapshotsOf([]), []);
  });
  it("section ids are declared and match Panel.tsx", () => {
    assert.deepEqual(backupSections.map((s) => s.id), ["last", "snapshots", "restore", "notice"]);
    const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
    const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual(used, backupSections.map((s) => s.id).sort());
  });
});
