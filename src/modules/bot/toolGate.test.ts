import { test } from "node:test";
import assert from "node:assert/strict";
import { botToolVerdict } from "./toolGate.ts";

test("unknown tools and pentest-flagged tools are refused; ordinary tools pass", () => {
  assert.equal(botToolVerdict(undefined, []).allowed, false);
  assert.match(botToolVerdict({ server: "s", name: "port_scan" }, []).reason, /engagement/);
  assert.equal(botToolVerdict({ server: "s", name: "lookup" }, ["lookup"]).allowed, false, "server config flags count");
  assert.equal(botToolVerdict({ server: "s", name: "x", category: "exploit-kit" }, []).allowed, false);
  assert.deepEqual(botToolVerdict({ server: "s", name: "get_weather" }, []), { allowed: true, reason: "" });
});
