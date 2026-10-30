import test from "node:test";
import assert from "node:assert/strict";
import { countBoxes, findModule, parseCommand } from "./terminalLogic.ts";

const mods = [{ id: "hub.news", name: "News" }, { id: "hub.email", name: "Mail" }, { id: "hub.pentest", name: "Pentest Lab" }, { id: "hub.notes", name: "Notes" }];

test("findModule by id tail, name, unique prefix", () => {
  assert.equal(findModule("news", mods)?.id, "hub.news");
  assert.equal(findModule("MAIL", mods)?.id, "hub.email");
  assert.equal(findModule("pentestlab", mods)?.id, "hub.pentest");
  assert.equal(findModule("pen", mods)?.id, "hub.pentest");
  assert.equal(findModule("n", mods), null); // ambiguous
});

test("parseCommand", () => {
  assert.deepEqual(parseCommand("open news", mods), { kind: "open", id: "hub.news" });
  assert.deepEqual(parseCommand("mail", mods), { kind: "open", id: "hub.email" });
  assert.deepEqual(parseCommand("home", mods), { kind: "home" });
  assert.deepEqual(parseCommand("?", mods), { kind: "help" });
  assert.deepEqual(parseCommand("zap", mods), { kind: "unknown", text: "zap" });
});

test("countBoxes keeps non-zero, biggest first", () => {
  assert.deepEqual(countBoxes({ "hub.news": 3, "hub.email": 12, "hub.notes": 0 }, mods).map((b) => b.n), [12, 3]);
});
