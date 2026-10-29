import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getDb, getLoadProblem, getDbDiagnostics, recordLoadProblem, resetDbForTests, type DbDeps } from "./db.ts";
import { SCHEMA_STATEMENTS } from "./schema.ts";

function fake(results: Array<Error | "ok">, rows: Record<string, unknown[] | Error> = {}) {
  const executed: string[] = [];
  const calls: { sql: string; params?: unknown[] }[] = [];
  let loads = 0;
  const db = {
    execute: async (s: string, params?: unknown[]) => { executed.push(s); calls.push({ sql: s, params }); },
    select: async (s: string) => {
      const key = s.includes("_sqlx_migrations") ? "mig" : s.includes("app_settings") ? "setting" : "tables";
      const r = rows[key] ?? [];
      if (r instanceof Error) throw r;
      return r;
    },
  };
  const deps: DbDeps = {
    load: async () => {
      const r = results[Math.min(loads++, results.length - 1)];
      if (r !== "ok") throw r;
      return db as never;
    },
  };
  return { deps, executed, calls, loads: () => loads };
}

beforeEach(() => resetDbForTests());

test("first load fails -> retried once -> ensureSchema -> resolves, problem kept", async () => {
  const f = fake([new Error("VersionMismatch(3)"), "ok"]);
  await getDb(f.deps);
  assert.equal(f.loads(), 2);
  assert.deepEqual(f.executed, SCHEMA_STATEMENTS);
  assert.match(getLoadProblem()!, /VersionMismatch\(3\)/);
});

test("both loads fail -> rejects and keeps the problem", async () => {
  const f = fake([new Error("first"), new Error("second")]);
  await assert.rejects(getDb(f.deps), /second/);
  assert.equal(f.loads(), 2);
  assert.match(getLoadProblem()!, /first/);
});

test("first load ok -> no problem, schema still ensured", async () => {
  const f = fake(["ok"]);
  await getDb(f.deps);
  assert.equal(getLoadProblem(), null);
  assert.equal(f.loads(), 1);
  assert.deepEqual(f.executed, SCHEMA_STATEMENTS);
});

test("concurrent callers share one load", async () => {
  const f = fake(["ok"]);
  const [a, b] = await Promise.all([getDb(f.deps), getDb(f.deps)]);
  assert.equal(a, b);
  assert.equal(f.loads(), 1);
});

test("after a rejection a later call can retry", async () => {
  const bad = fake([new Error("x"), new Error("y")]);
  await assert.rejects(getDb(bad.deps));
  const good = fake(["ok"]);
  await getDb(good.deps);
  assert.equal(good.loads(), 1);
});

test("diagnostics: migrations (short checksum) and tables", async () => {
  const f = fake(["ok"], {
    mig: [{ version: 1, description: "init", success: 1, checksum: "ABCDEF0123456789ABCDEF" }],
    tables: [{ name: "app_settings" }],
  });
  const d = await getDbDiagnostics(f.deps);
  assert.deepEqual(d.migrations, [{ version: 1, description: "init", success: true, checksum: "ABCDEF012345" }]);
  assert.deepEqual(d.tables, ["app_settings"]);
  assert.equal(d.error, null);
});

test("diagnostics: missing _sqlx_migrations -> empty list + error", async () => {
  const f = fake(["ok"], { mig: new Error("no such table: _sqlx_migrations"), tables: [{ name: "t" }] });
  const d = await getDbDiagnostics(f.deps);
  assert.deepEqual(d.migrations, []);
  assert.match(d.error!, /_sqlx_migrations/);
  assert.deepEqual(d.tables, ["t"]);
});

test("recordLoadProblem writes the redacted key when the first load failed", async () => {
  const f = fake([new Error("bad C:\\Users\\Bob\\x"), "ok"]);
  await recordLoadProblem(f.deps);
  const w = f.calls.find((c) => c.sql.startsWith("INSERT"))!;
  assert.deepEqual(w.params, ["db_load_problem", "bad C:\\Users\\<user>\\x"]);
});

test("recordLoadProblem deletes the key when clean", async () => {
  const f = fake(["ok"]);
  await recordLoadProblem(f.deps);
  const w = f.calls.find((c) => c.sql.startsWith("DELETE"))!;
  assert.deepEqual(w.params, ["db_load_problem"]);
});

test("loadProblem is reset at the start of a new load chain", async () => {
  await getDb(fake([new Error("old"), "ok"]).deps);
  assert.ok(getLoadProblem());
  resetDbForTests(); // simulate a fresh chain without the module reset of problem
  await getDb(fake(["ok"]).deps);
  assert.equal(getLoadProblem(), null);
});

test("diagnostics prefers local problem, else persisted, tolerates read failure", async () => {
  const local = fake([new Error("L"), "ok"], { setting: [{ value: "P" }] });
  let d = await getDbDiagnostics(local.deps);
  assert.equal(d.loadProblem, "L");
  assert.equal(d.loadProblemSource, "this webview");
  resetDbForTests();
  const persisted = fake(["ok"], { setting: [{ value: "P" }] });
  d = await getDbDiagnostics(persisted.deps);
  assert.equal(d.loadProblem, "P");
  assert.equal(d.loadProblemSource, "main window at startup");
  resetDbForTests();
  const broken = fake(["ok"], { setting: new Error("no such table") });
  d = await getDbDiagnostics(broken.deps);
  assert.equal(d.loadProblem, null);
  assert.equal(d.loadProblemSource, null);
});
