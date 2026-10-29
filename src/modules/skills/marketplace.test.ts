import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSource } from "./githubUrl.ts";
import { filterMarket, installForm, MARKET, MARKET_NOTE } from "./marketplace.ts";
import { splitCommand } from "./mcpConfig.ts";

test("every marketplace entry parses as an install source; MCP entries carry a command", () => {
  assert.equal(new Set(MARKET.map((e) => e.id)).size, MARKET.length);
  for (const e of MARKET) {
    assert.ok(parseSource(e.input).ok, e.input);
    if (e.kind === "mcp") assert.ok(["npx", "uvx"].includes(splitCommand(e.command ?? "")[0] ?? ""), e.id);
    assert.ok(!/exploit|pentest|scan|payload|crack/i.test(`${e.title} ${e.description}`), `no offensive tools: ${e.id}`);
  }
  assert.match(MARKET_NOTE, /verify before install/);
});

test("filter and install form", () => {
  assert.deepEqual(filterMarket("time zones").map((e) => e.id), ["mcp-time"]);
  assert.equal(filterMarket("").length, MARKET.length);
  assert.deepEqual(installForm(MARKET[1]), { input: "modelcontextprotocol/servers:src/fetch", kind: "mcp", command: "uvx mcp-server-fetch", env: "", secrets: "", flagged: "", bundle: "" });
});
