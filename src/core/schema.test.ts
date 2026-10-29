import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { SCHEMA_STATEMENTS, ensureSchema, describeDb, redactPaths } from "./schema.ts";

const norm = (s: string) => s.replace(/IF NOT EXISTS/gi, "").replace(/\s+/g, "").replace(/;$/, "");
const files = ["17_panel_layout", "18_game_mode_auto", "19_panel_prefs", "20_youtube_channels", "21_youtube_watched", "22_chat_rooms"];

test("SCHEMA_STATEMENTS match migrations 17-22 exactly", () => {
  assert.equal(SCHEMA_STATEMENTS.length, files.length);
  files.forEach((f, i) => {
    const sql = readFileSync(new URL(`../../src-tauri/migrations/${f}.sql`, import.meta.url), "utf8");
    assert.equal(norm(SCHEMA_STATEMENTS[i]), norm(sql), f);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS/, `${f} must be idempotent`);
    assert.match(SCHEMA_STATEMENTS[i], /CREATE TABLE IF NOT EXISTS/);
  });
});

test("ensureSchema runs every statement in order", async () => {
  const seen: string[] = [];
  await ensureSchema(async (s) => { seen.push(s); });
  assert.deepEqual(seen, SCHEMA_STATEMENTS);
});

test("ensureSchema stops and rethrows on first failure", async () => {
  const seen: string[] = [];
  await assert.rejects(
    ensureSchema(async (s) => { seen.push(s); if (seen.length === 2) throw new Error("boom"); }),
    /boom/
  );
  assert.equal(seen.length, 2);
});

test("ensureSchema is safe to run twice", async () => {
  let n = 0;
  await ensureSchema(async () => { n++; });
  await ensureSchema(async () => { n++; });
  assert.equal(n, SCHEMA_STATEMENTS.length * 2);
});

test("describeDb builds a plain-text report", () => {
  const t = describeDb({
    loadProblem: "VersionMismatch(3)", loadProblemSource: "this webview",
    migrations: [{ version: 1, description: "init", success: true, checksum: "abcdef123456" }],
    tables: ["a", "b"],
    error: null,
  });
  assert.match(t, /VersionMismatch\(3\)/);
  assert.match(t, /1 init ok abcdef123456/);
  assert.match(t, /a, b/);
  assert.match(describeDb({ loadProblem: null, loadProblemSource: null, migrations: [], tables: [], error: "no such table" }), /no such table/);
});

const tableOf = (sql: string) => /CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/i.exec(sql)?.[1];

// A new migration (20+) must be mirrored in SCHEMA_STATEMENTS, or it never
// applies on a DB whose plugin migrate failed. NOTE: ALTER TABLE ADD COLUMN is
// not covered by IF NOT EXISTS; mirror it with a pragma_table_info guard.
test("every migration >= 17 has a bootstrap entry and vice versa", () => {
  const dir = new URL("../../src-tauri/migrations/", import.meta.url);
  const tables = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && parseInt(f, 10) >= 17)
    .map((f) => {
      const t = tableOf(readFileSync(new URL(f, dir), "utf8"));
      assert.ok(t, `${f} must be a CREATE TABLE (add a guarded bootstrap entry for other DDL)`);
      return t;
    });
  const boot = SCHEMA_STATEMENTS.map((s) => tableOf(s));
  assert.deepEqual([...tables].sort(), [...boot].sort());
});

test("redactPaths hides user names", () => {
  assert.equal(redactPaths("open C:\\Users\\Bob\\AppData\\x.db failed"), "open C:\\Users\\<user>\\AppData\\x.db failed");
  assert.equal(redactPaths("c:/users/bob/x"), "c:/users/<user>/x");
  assert.equal(redactPaths("/home/bob/.local and /Users/al/y"), "/home/<user>/.local and /Users/<user>/y");
  assert.equal(redactPaths("no paths"), "no paths");
});
