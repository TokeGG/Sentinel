import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_STATEMENTS, ensureSchema } from "./schema.ts";
import { addColumnSql, columnsOf } from "./schemaColumns.ts";

const dir = new URL("../../src-tauri/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

// table -> "col type notnull default pk" for every user table
function shape(db: DatabaseSync): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  for (const { name } of tables) {
    const cols = db.prepare(`SELECT name, type, "notnull" AS nn, dflt_value AS d, pk FROM pragma_table_info('${name}')`).all() as Record<string, unknown>[];
    out[name] = cols.map((c) => `${c.name} ${c.type} ${c.nn} ${c.d} ${c.pk}`);
  }
  return out;
}

const execSync = (db: DatabaseSync) => async (sql: string) => { db.exec(sql); };
const colsSync = (db: DatabaseSync) => async (t: string) =>
  (db.prepare("SELECT name FROM pragma_table_info(?)").all(t) as { name: string }[]).map((r) => r.name);

test("SCHEMA_STATEMENTS alone create every table AND column of every migration", async () => {
  assert.ok(files.length >= 48);
  const migrated = new DatabaseSync(":memory:");
  for (const f of files) migrated.exec(readFileSync(new URL(f, dir), "utf8"));
  const boot = new DatabaseSync(":memory:");
  assert.deepEqual(await ensureSchema(execSync(boot), colsSync(boot)), []);
  assert.deepEqual(shape(boot), shape(migrated));
});

test("migrations still apply after a bootstrap (compat DB later migrates)", async () => {
  const db = new DatabaseSync(":memory:");
  await ensureSchema(execSync(db));
  // 1-16 are not IF NOT EXISTS; they are applied on such DBs already. 17+ must re-run cleanly.
  for (const f of files.filter((f) => parseInt(f, 10) >= 17)) db.exec(readFileSync(new URL(f, dir), "utf8"));
});

test("ensureSchema adds columns missing from an older copy of a table", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL)");
  db.exec("INSERT INTO notes (body) VALUES ('hi')");
  assert.deepEqual(await ensureSchema(execSync(db), colsSync(db)), []);
  const cols = (await colsSync(db)("notes")).sort();
  assert.deepEqual(cols, ["body", "created_at", "filed_to", "id", "tags"]);
  db.exec("INSERT INTO notes (body, tags) VALUES ('x', 'y')");
});

test("addColumnSql rules", () => {
  const sql = "CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, a TEXT NOT NULL DEFAULT 'x', b TEXT NOT NULL, c TEXT NOT NULL DEFAULT (datetime('now')), d TEXT UNIQUE, PRIMARY KEY (id))";
  assert.deepEqual(columnsOf(sql).map((c) => c.name), ["id", "a", "b", "c", "d"]);
  assert.deepEqual(addColumnSql(sql, ["id"]), [
    "ALTER TABLE t ADD COLUMN a TEXT NOT NULL DEFAULT 'x'",
    "ALTER TABLE t ADD COLUMN b TEXT",
    "ALTER TABLE t ADD COLUMN c TEXT",
  ]);
  assert.deepEqual(addColumnSql(sql, []), []);
  assert.equal(SCHEMA_STATEMENTS.every((s) => columnsOf(s).length > 0), true);
});
