import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { argsMention, isFlagged, makeCallMcpTool, type McpTool } from "./mcpGate.ts";
import { checkScope } from "../pentest/scope.ts";

const tools: McpTool[] = [
  { server: "s", name: "summarize" },
  { server: "s", name: "port_scan" },
  { server: "s", name: "probe", category: "Exploit" },
  { server: "s", name: "custom", _meta: { category: "recon" } },
];
const eng = [{ clientName: "Acme", scope: "10.0.0.0/24", startsAt: "2026-01-01", endsAt: "2027-01-01", status: "active" as const }];
function setup(flags: string[] = []) {
  const invoked: unknown[] = [];
  const call = makeCallMcpTool({
    invoke: async (cmd, a) => (invoked.push([cmd, a]), { ok: true }),
    tools: async () => tools,
    flags: async () => flags,
    // the real gate function, same arguments the pentest module uses
    gate: async (_id, target) => checkScope(target, eng, [], "2026-10-29T00:00:00Z"),
  });
  return { call, invoked };
}

describe("isFlagged / argsMention", () => {
  it("flags by name, declared category and config", () => {
    assert.ok(isFlagged(tools[1], []) && isFlagged(tools[2], []));
    assert.ok(!isFlagged(tools[0], []) && !isFlagged(tools[3], []));
    assert.ok(isFlagged(tools[3], ["Recon"]) && isFlagged(tools[0], ["summarize"]));
  });
  it("argsMention searches nested values", () => {
    assert.ok(argsMention({ a: [{ host: "http://10.0.0.5/x" }] }, "10.0.0.5"));
    assert.ok(!argsMention({ a: "1.2.3.4" }, "10.0.0.5") && !argsMention({}, "") && !argsMention({ a: 5 }, "5"));
  });
});

describe("makeCallMcpTool", () => {
  it("passes unflagged tools straight through", async () => {
    const { call, invoked } = setup();
    assert.deepEqual(await call("s", "summarize", { text: "hi" }), { ok: true });
    assert.deepEqual(invoked, [["mcp_call", { id: "s", tool: "summarize", args: { text: "hi" } }]]);
  });
  it("a flagged tool without an engagement never reaches invoke", async () => {
    const { call, invoked } = setup();
    await assert.rejects(call("s", "port_scan", { host: "10.0.0.5" }), /engagement/);
    assert.equal(invoked.length, 0);
  });
  it("a flagged tool with an out-of-scope target never reaches invoke", async () => {
    const { call, invoked } = setup();
    for (const t of ["8.8.8.8", "example.com", "10.0.1.5", "not a target"])
      await assert.rejects(call("s", "port_scan", { host: t }, { engagement: { id: 1, target: t } }), /scope gate/, t);
    assert.equal(invoked.length, 0);
  });
  it("an in-scope check cannot be paired with different arguments", async () => {
    const { call, invoked } = setup();
    await assert.rejects(call("s", "port_scan", { host: "8.8.8.8" }, { engagement: { id: 1, target: "10.0.0.5" } }), /must contain/);
    assert.equal(invoked.length, 0);
  });
  it("an in-scope target is allowed through", async () => {
    const { call, invoked } = setup();
    await call("s", "port_scan", { host: "10.0.0.5" }, { engagement: { id: 1, target: "10.0.0.5" } });
    assert.equal(invoked.length, 1);
  });
  it("config-flagged and category-flagged tools are gated too; unknown tools fail", async () => {
    const { call, invoked } = setup(["summarize"]);
    await assert.rejects(call("s", "summarize", {}), /engagement/);
    await assert.rejects(call("s", "probe", {}), /engagement/);
    await assert.rejects(call("s", "nope", {}), /not available/);
    assert.equal(invoked.length, 0);
  });
});
