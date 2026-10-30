import { test } from "node:test";
import assert from "node:assert/strict";
import { keysOf, MODULE_DATA, resetPlan, tablesOf, unmapped, wipePlan } from "./dataMap.ts";
import { buildReport, filterLog, logModules, purgeSteps, type LogRow } from "./history.ts";

const ALL = ["app_settings", "panel_layout", "mail_accounts", "mail_meta", "notes", "note_meta", "news_saved", "weird_thing", "activity_log", "sqlite_sequence"];
const mod = (id: string) => MODULE_DATA.find((m) => m.id === id)!;

test("tables by prefix/list, shell tables never included", () => {
  assert.deepEqual(tablesOf(mod("hub.email"), ALL), ["mail_accounts", "mail_meta"]);
  assert.deepEqual(tablesOf(mod("hub.notes"), ALL), ["note_meta", "notes"]);
  assert.ok(!MODULE_DATA.some((m) => tablesOf(m, ALL).includes("app_settings")));
  assert.deepEqual(unmapped(ALL), ["weird_thing"]);
});
test("keys: exact, prefix and module-owned", () => {
  const keys = ["yt_queue", "yt_live", "modset:hub.youtube", "modset:hub.news", "theme"];
  assert.deepEqual(keysOf(mod("hub.youtube"), keys), ["modset:hub.youtube", "yt_live", "yt_queue"]);
});
test("wipe deletes tables + keys; reset keeps data", () => {
  const m = mod("hub.email");
  const w = wipePlan(m, ["mail_meta", "bad;drop"], ["modset:hub.email"]);
  assert.equal(w[0].sql, "DELETE FROM mail_meta");
  assert.ok(!w.some((s) => s.sql.includes("bad")));
  const r = resetPlan(m, ["modset:hub.email"]);
  assert.ok(r.every((s) => !s.sql.includes("mail_")));
  assert.deepEqual(r.at(-1)!.args, ["hub.email"]);
});
test("purge off at 0, cutoffs otherwise", () => {
  assert.deepEqual(purgeSteps(0, 0), []);
  const s = purgeSteps(7, 10 * 86_400_000);
  assert.deepEqual(s[0].args, ["-7 days"]);
  assert.deepEqual(s[1].args, [3 * 86_400_000]);
});
const row = (id: number, module: string, result: string): LogRow => ({ id, module, skill: "x", summary: "s", result, created_at: "t" });
test("log filter and report", () => {
  const rows = [row(1, "news", "ok"), row(2, "mail", "Error: C:\\Users\\bob\\x")];
  assert.equal(filterLog(rows, "error", "").length, 1);
  assert.equal(filterLog(rows, "", "news").length, 1);
  assert.deepEqual(logModules(rows), ["mail", "news"]);
  const rep = buildReport({ version: "1", userAgent: "ua", at: "now", tables: ["a"], migrations: [1], loadProblem: null, log: rows, prefs: {} });
  assert.match(rep, /Recent problems \(1\)/);
  assert.ok(!rep.includes("bob"));
});
