import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { open, parseEnvelope, seal } from "./envelope.ts";
import { exportable, importPlan, insertSql, makeBundle, parseBundle } from "./exportLogic.ts";

describe("envelope", () => {
  it("round-trips and rejects a wrong passphrase", async () => {
    const env = await seal("hello {\"a\":1}", "correct horse", 100_000);
    const back = parseEnvelope(JSON.stringify(env));
    assert.equal(await open(back, "correct horse"), "hello {\"a\":1}");
    await assert.rejects(open(back, "wrong pass!"), /wrong passphrase/);
    assert.ok(!JSON.stringify(env).includes("hello"));
  });
  it("validates input", async () => {
    await assert.rejects(seal("x", "short"), /at least 8/);
    assert.throws(() => parseEnvelope("{}"), /not a Sentinel/);
    assert.throws(() => parseEnvelope("nope"), /not a Sentinel/);
  });
});
describe("bundle", () => {
  it("filters tables, scrubs secret columns, plans import", () => {
    assert.deepEqual(exportable(["notes", "sqlite_sequence", "_sqlx_migrations", "mail_messages", "bad-name", "app_settings"]), ["notes", "app_settings"]);
    const b = parseBundle(JSON.stringify(makeBundle({ notes: [{ id: 1, body: "x", api_key: "k" }], ghost: [{ a: 1 }] }, new Date(0))));
    assert.deepEqual(b.tables.notes[0], { id: 1, body: "x" });
    const plan = importPlan(b, { notes: ["id", "body", "tags"] });
    assert.deepEqual(plan, [{ table: "notes", rows: 1, columns: ["id", "body"] }]);
    assert.equal(insertSql(plan[0]), "INSERT OR REPLACE INTO notes (id, body) VALUES ($1, $2)");
    assert.throws(() => parseBundle("{}"));
  });
});
