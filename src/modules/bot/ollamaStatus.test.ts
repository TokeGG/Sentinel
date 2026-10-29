import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnoseOllama, reachOf } from "./ollamaStatus.ts";

const tags = { models: [{ name: "llama3.1:8b", size: 1 }] };
const ok = { installed: true, reach: "ok" as const, tags };

test("each failure has its own fix", () => {
  assert.equal(diagnoseOllama("x", { installed: false, reach: "down", tags: null }).kind, "not_installed");
  assert.match(diagnoseOllama("x", { installed: false, reach: "down", tags: null }).text, /ollama pull llama3\.1:8b/);
  assert.equal(diagnoseOllama("x", { installed: true, reach: "down", tags: null }).kind, "not_running");
  assert.equal(diagnoseOllama("x", { installed: null, reach: "down", tags: null }).kind, "not_running");
  assert.match(diagnoseOllama("x", { installed: true, reach: "forbidden", tags: null }).text, /OLLAMA_ORIGINS/);
  assert.equal(diagnoseOllama("x", { ...ok, tags: { models: [] } }).kind, "no_models");
  assert.equal(diagnoseOllama(null, ok).kind, "no_selection");
  assert.match(diagnoseOllama("qwen2.5:7b", ok).text, /ollama pull qwen2\.5:7b/);
  assert.equal(diagnoseOllama("llama3.1:8b", ok).ok, true);
});

test("reach classification", () => {
  assert.equal(reachOf(200), "ok");
  assert.equal(reachOf(403), "forbidden");
  assert.equal(reachOf(500), "error");
  assert.equal(reachOf(null, "not_running: nothing answers"), "down");
  assert.equal(reachOf(null, "weird"), "error");
});
